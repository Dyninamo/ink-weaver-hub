# 243 — Correct weather_daily wind units in Supabase

**Date:** 2026-09-17
**Origin:** `weather_daily.wind_speed_ms` held km/h in 366,190 rows and m/s in the
rest. Fixed in master on 2026-09-17; Supabase still holds the old mixed values.

---

## Background

Two writers populated that column and only one converted Meteostat/Open-Meteo's
km/h to m/s. `granularity` does **not** separate them — both live writers stamp
`'daily'` — so the split is per **location**, established by comparing every
location against the Open-Meteo archive and, where that was inconclusive, against
Meteostat's own `wspd`. Full detail in
`project_documentation/code_opus/WIND_UNIT_BLAST_RADIUS.md`.

Supabase was verified to still match master's pre-fix values exactly (Grafham
2026-02-24 = 19.31 on both), so applying the same per-location conversion here
lands on the same numbers rather than guessing.

Every live consumer assumes m/s, so for these locations the PWA currently shows
wind **2.24× too high** and classifies almost every day as "Strong".

## ⚠ This migration is NOT idempotent

Dividing by 3.6 twice is silent and unrecoverable. **Task 1 is a guard — run it
first and stop if it returns anything.**

## Task 1 — refuse to run twice (required)

```sql
-- Grafham is in the km/h list. If it is already below 10 the conversion has
-- already been applied; STOP and do not run Task 2.
SELECT location, date, wind_speed_ms
FROM public.weather_daily
WHERE location = 'Grafham Water' AND date = '2026-02-24';
```

Expected **before** conversion: `19.31`. If it is ~`5.36`, this migration has
already run — stop here.

## Task 2 — convert the km/h locations (230 locations, 366,190 rows)

```sql
UPDATE public.weather_daily
SET wind_speed_ms = ROUND((wind_speed_ms / 3.6)::numeric, 2)
WHERE wind_speed_ms IS NOT NULL
  AND location IN (
    'Abbey Dore, Monnow', 'Aberbaiden, Usk', 'Aberbwtran, Irfon & Ithon', 'Abercynrig, Usk', 'Abergavenny Town Water, Usk', 'Abernant, Upper Wye',
    'Aberystwyth Angling Association, Rheidol', 'Albury Estate Fisheries – Albury', 'Alton Water', 'Ardleigh Reservoir', 'Arrow Monkland, Lugg & Arrow', 'Arrow Titley, Lugg & Arrow',
    'Ashford House, Usk', 'Avington Trout Fisheries', 'Bargoed Park (Taff Bargoed AA), Lakes', 'Barn Elms Trout Fishery', 'Barnard Castle, Tees', 'Barrow Angling Association – Pennington Reservoir',
    'Barrow Gurney Tank 2', 'Beacons Reservoir, Reservoirs', 'Bewl Water', 'Bideford Brook, Severn', 'Bigwell Fly Fishery', 'Blackpool Brook, Severn',
    'Blakewell Trout Farm and Smokery', 'Blithfield Anglers', 'Bransford Farm Fisheries', 'Brick Farm Lakes Trout Fishery', 'Buckland, Usk', 'Bucknell, Teme',
    'Cannop Brook, Severn', 'Caradoc, Middle Wye', 'Carmarthen Amateur Angling Association, Towy', 'Cefn Rhosan Fawr, Usk', 'Cefni Reservoir - Bank FishingTickets, Reservoirs', 'Cefni Reservoir - Boat FishingTickets, Reservoirs',
    'Chainbridge, Usk', 'Chalk Springs Trout Fishery', 'Chanstone Court, Monnow', 'Chatton Trout Fishery', 'Chew Valley Lake', 'Clettwr, Upper Wye',
    'Cleveleymere', 'Clwb Godre''r Mynydd Du, Towy', 'Colliford Reservoir', 'Colonel''s Water, Irfon & Ithon', 'Court of Noke, Lugg & Arrow', 'Courtfield, Lower Wye',
    'Craig Llyn, Upper Wye', 'Craigluscar Fishery', 'Cringle Reservoir', 'Cwm Rheidol Reservoir (Aberystwyth AA), Upland Llyns', 'Cwm Silyn (SGLL Fishing Society), Upland Llyns', 'Cwm Y Glo - Crawia Section (SGLL Fishing Society), Seiont',
    'Cwmwysg Ganol, Usk', 'Dan Y Parc, Usk', 'Darlington Brown Trout AA North Bank - River Tees, Tees', 'Darlington Brown Trout AA South Bank - River Tees, Tees', 'Dinas, Usk', 'Disserth Ithon, Irfon & Ithon',
    'Doldowlod, Upper Wye', 'Dolgau, Upper Wye', 'Draycote Water', 'Dryslwyn Castle - Golden Grove, Towy', 'Dufnant, Usk', 'Duhonw, Upper Wye',
    'Edw Aberedw, Upper Wye', 'Edw Cregrina, Upper Wye', 'Edw Hergest, Upper Wye', 'Edw Hundred House, Upper Wye', 'Eggleston Hall, Tees', 'Eyebrook Reservoir',
    'Farmoor Trout Fishery', 'Fenni Fach, Usk', 'Ffynnon Lloer (Ogwen Valley Angling Association), Upland Llyns', 'Fiddlers Elbow to Abercynon (Taff Bargoed AA), Taff', 'Fownhope 5, Middle Wye', 'Foy Bridge, Middle Wye',
    'Frensham Trout Fishery', 'Ghyll Head Reservoir', 'Glan Gwna (SGLL Fishing Society), Seiont', 'Glan-y-Cafn, Usk', 'Glan-yr-Afon, Usk', 'Glanrafon (SGLL Fishing Society), Seiont',
    'Glanusk Estate Fishery, Usk', 'Glanusk Tymawr/Canal & Rivers Trust, Usk', 'Glynneath & District AA, Neath', 'Gofynne, Irfon & Ithon', 'Goldenloch Fishing', 'Goodrich Court, Lower Wye',
    'Grafham Water', 'Green Drive, Usk', 'Greenbank, Usk', 'Greta Farm, Greta', 'Hastings Fly Fishers Club', 'Hergest Court, Lugg & Arrow',
    'High Coniscliffe, Tees', 'Hindwell - Coombe, Lugg & Arrow', 'Hindwell - Knill, Lugg & Arrow', 'Hollowell Reservoir', 'Holme Lacy 3 and Lechmere''s Ley, Middle Wye', 'Home Fishery, Lower Wye',
    'Honddu - R Usk, Usk - Wild Stream', 'Honddu Lower Stanton, Monnow', 'Honddu Pandy, Monnow', 'Innis Fly Fishery', 'Kilnsey Park', 'Ladybower Fisheries',
    'Lakedown Trout Fishery', 'Lechlade and Bushyleaze Trout Fisheries', 'Leighton Fly Fishing', 'Linlithgow Loch', 'Llanddewi, Irfon & Ithon', 'Llandovery Angling Association, Towy',
    'Llanfechan, Irfon & Ithon', 'Llangadog, Towy', 'Llangoed, Upper Wye', 'Llangollen Maelor Angling, Dee', 'Llanilar Angling Association - River Ystwyth, Ystwyth', 'Llanstephan, Upper Wye',
    'Llanwysg, Usk', 'Llwyn Corner, Usk', 'Llwyn On Reservoir, Reservoirs', 'Llyn Blaenmelindwr (Aberystwyth AA), Upland Llyns', 'Llyn Bochlwyd (Ogwen Valley Angling Association), Upland Llyns', 'Llyn Bugeilyn, Upland Llyns',
    'Llyn Coedty (Dolgarrog Fishing Club), Upland Llyns', 'Llyn Craigypistyll (Aberystwyth AA), Upland Llyns', 'Llyn Cwellyn (SGLL Fishing Society), Upland Llyns', 'Llyn Dulyn (Dolgarrog Fishing Club), Upland Llyns', 'Llyn Eigiau (Dolgarrog Fishing Club), Upland Llyns', 'Llyn Frongoch (Aberystwyth AA), Upland Llyns',
    'Llyn Idwal (Ogwen Valley Angling Association), Upland Llyns', 'Llyn Lygad Rheidol (Aberystwyth AA), Upland Llyns', 'Llyn Melynllyn (Dolgarrog Fishing Club), Upland Llyns', 'Llyn Ogwen (Ogwen Valley Angling Association), Upland Llyns', 'Llyn Padarn (SGLL Fishing Society), Upland Llyns', 'Llyn Rhosgoch (Aberystwyth AA), Upland Llyns',
    'Llyn Syfydrin (Aberystwyth AA), Upland Llyns', 'Llyn y Dywarchen (SGLL Fishing Society), Upland Llyns', 'Llyn-yr-oerfa (Aberystwyth AA), Upland Llyns', 'Llynfi Dulas Middle, Upper Wye', 'Llynfi Talgarth, Upper Wye', 'Loch Fad Fisheries',
    'Loganlea Trout Fishery', 'Lower Crai, Usk - Wild Stream', 'Lower Grywne Fawr, Usk - Wild Stream', 'Lower Longtown, Monnow', 'Lower Tarrell, Usk - Wild Stream', 'Lugg Litton, Lugg & Arrow',
    'Lyepole, Lugg & Arrow', 'Melyn Cildu, Irfon & Ithon', 'Merthyr Tydfil Angling Alliance, Taff', 'Mickleton Island, Tees', 'Middle Ballingham & Fownhope No.8, Middle Wye', 'Middle Bran, Usk - Wild Stream',
    'Middle Hill Court, Lower Wye', 'Monikie AC', 'Monnow Valley, Monnow', 'Moorhen Trout Fishery', 'New Mills Trout Fishery', 'Northbrook Fish Farm',
    'Oakfield, Irfon & Ithon', 'Ogwen Valley Angling Association, Ogwen', 'Old Clytha, Usk', 'Parc Fishery, Usk - Wild Stream', 'Pembrokeshire AA Eastern & Western Cleddau, Eastern and Western Cleddau', 'Penpont, Usk',
    'Pinewood Trout Fishery', 'Pitsford Water', 'Pond Glandwgan (Aberystwyth AA), Upland Llyns', 'Pond Rhosrydd (Aberystwyth AA), Upland Llyns', 'Pontardawe & Swansea AA, Tawe', 'Pontarddulais AA Loughor, Loughor',
    'Pontarddulais AA Teifi, Teifi', 'Pontithel - River Llynfi, Upper Wye', 'Raby Estate - River Tees, Tees', 'Ravensthorpe Reservoir', 'Red Lion/Moccas Fishery, Middle Wye', 'Rhayader and Elan Valley Angling Association',
    'Rhosgoch', 'River Alyn - Rossett & Gresford Flyfishers, Dee', 'River Cammarch, Irfon & Ithon', 'River Kennet', 'River Prysor - Beat 1, Prysor', 'River Prysor - Beat 2, Prysor',
    'Rosebery Reservoir Fishery', 'Rutland Water', 'Serenity House Lower Irfon Fishery, Irfon & Ithon', 'Serenity House Upper Irfon Fishery, Irfon & Ithon', 'Sharpley Springs Fly Fishery', 'Skenfrith, Monnow',
    'St Andrews Angling Club', 'Strathmore Estate - Upper Tees & Maize Beck, Tees', 'Sutton Springs Fishing At Testwood', 'Taff Fechan, Taff', 'Talybont Reservoir, Reservoirs', 'Tarvie Lochs Trout Fishery',
    'Taverham Mill', 'Tawe - Beat One, Tawe', 'Tawe - Beat Two, Tawe', 'Temple Trout Fisheries', 'The Breconshire Fishery, Usk', 'The Clywedog, Irfon & Ithon',
    'The Dulas, Monnow', 'The Eyton Beat, Lugg & Arrow', 'The Foy Fishery, Middle Wye', 'The Rectory Fishery, Upper Wye', 'The Rocks, Upper Wye', 'The Severn Arms Ithon - Beat 1, Irfon & Ithon',
    'The Watch Water Fishery', 'Thomas Wood, Lower Wye', 'Thrunton Long Crag Trout Fishery', 'Ty Mawr, Upper Wye', 'Ty Newydd, Upper Wye', 'Upper Bigsweir, Lower Wye',
    'Upper Grywne Fawr, Usk - Wild Stream', 'Upper Hill Court, Lower Wye', 'Upper Tower, Usk', 'Usk Reservoir, Reservoirs', 'Usk Town Water, Usk', 'White House, Middle Wye',
    'Whitney Court, Middle Wye', 'Whittern Lyonshall, Lugg & Arrow', 'Wimbleball Fly Fishery', 'Wistlandpound Reservoir', 'Wormit Fishings', 'Wyastone Leys, Lower Wye',
    'Wyebank, Lower Wye', 'Wyesham, Lower Wye'
  );
```

## Task 3 — null the rows whose unit could not be established (15 locations, 5,250 rows)

These could not be classified by any method. A wrong number that looks plausible
is worse than a missing one, and master has already nulled them, so Supabase must
match or the two disagree.

```sql
UPDATE public.weather_daily
SET wind_speed_ms = NULL
WHERE wind_speed_ms IS NOT NULL
  AND location IN (
    'Arnfield Fly Fishery', 'Arrow Kington, Lugg & Arrow', 'Burnhouse Lochan', 'Colliford Lake', 'Eden Springs Fishery', 'Fisherwick Lakes',
    'Hollies Trout Farm', 'Honddu Lower Henllan, Monnow', 'Honddu Maes y Beran, Monnow', 'Kennick Reservoir', 'Lower Clochfaen, Upper Wye', 'Loynton Fishery',
    'Newmill Trout Fishery and Tackle Shop', 'Swanswater Fishery', 'Upper Clochfaen, Upper Wye'
  );
```

## Verification — assert the data, not the exit code

```sql
-- 1. the sentinel row is now ~5.36
SELECT wind_speed_ms FROM public.weather_daily
WHERE location='Grafham Water' AND date='2026-02-24';

-- 2. no location should average 9 m/s or more. A daily mean of 9 m/s (20 mph)
--    every day it has data is not a windy venue, it is still km/h.
SELECT location, COUNT(*) n, ROUND(AVG(wind_speed_ms)::numeric,2) avg_ms
FROM public.weather_daily
WHERE wind_speed_ms IS NOT NULL
GROUP BY location HAVING AVG(wind_speed_ms) >= 9
ORDER BY avg_ms DESC;
```

Query 2 should return **at most one row** — `Wrackleford`, 8 rows, ~11.29, which
was verified as genuine m/s against Meteostat and is left alone.

Master-side equivalents for comparison after you run it: overall avg **5.29 m/s**,
`daily` **5.24**, `day` **6.85**, 5,250 rows nulled.

## Not in this prompt

`reports_enriched`'s wind columns are recomputed values rather than a formula, so
they are pushed from master as data, not fixed by SQL here.

Renaming `wind_speed_ms` — the name is what caused this — needs master and
Supabase changed together and should be its own prompt once this has landed.
