UPDATE public.user_presets
SET rod =
    (rod
      || jsonb_build_object(
           'rodLengthFt',
             COALESCE(
               (rod ->> 'rodLengthFt')::numeric,
               CASE WHEN rod ->> 'rodLength' ~ '^[0-9]+(\.[0-9]+)?ft$'
                    THEN (regexp_replace(rod ->> 'rodLength', 'ft$', ''))::numeric
                    ELSE NULL END
             ),
           'leaderLengthFt',
             COALESCE(
               (rod ->> 'leaderLengthFt')::numeric,
               CASE WHEN rod ->> 'leaderLength' ~ '^[0-9]+(\.[0-9]+)?ft$'
                    THEN (regexp_replace(rod ->> 'leaderLength', 'ft$', ''))::numeric
                    ELSE NULL END
             ),
           'lineProfile',
             COALESCE(rod ->> 'lineProfile', rod ->> 'line')
         )
    )
    - 'rodLength' - 'leaderLength' - 'line'
WHERE
  rod ? 'rodLength' OR rod ? 'leaderLength' OR rod ? 'line';