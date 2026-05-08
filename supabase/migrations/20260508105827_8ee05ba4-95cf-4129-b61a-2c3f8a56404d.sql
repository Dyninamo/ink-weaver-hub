
UPDATE public.leaders
   SET material = CASE lower(material)
       WHEN 'fluorocarbon' THEN 'fluoro'
       WHEN 'fluoro'       THEN 'fluoro'
       WHEN 'nylon'        THEN 'nylon'
       WHEN 'copolymer'    THEN 'copolymer'
       WHEN 'mono'         THEN 'mono'
       WHEN 'furled'       THEN 'furled'
       ELSE 'nylon'
   END
 WHERE material IS NOT NULL;

ALTER TABLE public.leaders DROP CONSTRAINT IF EXISTS leaders_material_check;
ALTER TABLE public.leaders
    ADD CONSTRAINT leaders_material_check
        CHECK (material IS NULL
            OR material IN ('nylon','copolymer','mono','fluoro','furled'));

ALTER TABLE public.user_profiles
    ALTER COLUMN river_default_species SET DEFAULT 'Brown trout';

UPDATE public.user_profiles
   SET river_default_species = 'Brown trout'
 WHERE river_default_species = 'Grayling';

NOTIFY pgrst, 'reload schema';
