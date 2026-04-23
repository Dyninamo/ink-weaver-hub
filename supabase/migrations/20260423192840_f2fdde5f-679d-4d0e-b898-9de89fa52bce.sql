-- 1. Add missing columns
ALTER TABLE public.report_seasonal_fly_rankings
    ADD COLUMN IF NOT EXISTS n_reports   INTEGER,
    ADD COLUMN IF NOT EXISTS mention_pct REAL,
    ADD COLUMN IF NOT EXISTS month_name  TEXT;

ALTER TABLE public.report_condition_fly_rankings
    ADD COLUMN IF NOT EXISTS n_reports   INTEGER,
    ADD COLUMN IF NOT EXISTS mention_pct REAL;

-- 2. fly_water_types — drop old restrictive policies, add anon-upsert
DROP POLICY IF EXISTS "Allow authenticated delete on fly_water_types" ON public.fly_water_types;
DROP POLICY IF EXISTS "Allow authenticated insert on fly_water_types" ON public.fly_water_types;
DROP POLICY IF EXISTS fly_water_types_write ON public.fly_water_types;
DROP POLICY IF EXISTS fly_water_types_service_write ON public.fly_water_types;
DROP POLICY IF EXISTS fly_water_types_anon_upsert ON public.fly_water_types;
CREATE POLICY fly_water_types_anon_upsert ON public.fly_water_types
    FOR ALL USING (true) WITH CHECK (true);

-- 3. pattern_fly_conditions
DROP POLICY IF EXISTS pattern_fly_conditions_write ON public.pattern_fly_conditions;
DROP POLICY IF EXISTS pattern_fly_conditions_service_write ON public.pattern_fly_conditions;
DROP POLICY IF EXISTS pattern_fly_conditions_anon_upsert ON public.pattern_fly_conditions;
CREATE POLICY pattern_fly_conditions_anon_upsert ON public.pattern_fly_conditions
    FOR ALL USING (true) WITH CHECK (true);

-- 4. wt_monthly_fly_advice
DROP POLICY IF EXISTS wt_monthly_fly_advice_write ON public.wt_monthly_fly_advice;
DROP POLICY IF EXISTS wt_monthly_fly_advice_service_write ON public.wt_monthly_fly_advice;
DROP POLICY IF EXISTS wt_monthly_fly_advice_anon_upsert ON public.wt_monthly_fly_advice;
CREATE POLICY wt_monthly_fly_advice_anon_upsert ON public.wt_monthly_fly_advice
    FOR ALL USING (true) WITH CHECK (true);

-- 5. report_seasonal_fly_rankings
DROP POLICY IF EXISTS report_seasonal_fly_rankings_write ON public.report_seasonal_fly_rankings;
DROP POLICY IF EXISTS report_seasonal_fly_rankings_service_write ON public.report_seasonal_fly_rankings;
DROP POLICY IF EXISTS report_seasonal_fly_rankings_anon_upsert ON public.report_seasonal_fly_rankings;
CREATE POLICY report_seasonal_fly_rankings_anon_upsert ON public.report_seasonal_fly_rankings
    FOR ALL USING (true) WITH CHECK (true);

-- 6. report_condition_fly_rankings
DROP POLICY IF EXISTS report_condition_fly_rankings_write ON public.report_condition_fly_rankings;
DROP POLICY IF EXISTS report_condition_fly_rankings_service_write ON public.report_condition_fly_rankings;
DROP POLICY IF EXISTS report_condition_fly_rankings_anon_upsert ON public.report_condition_fly_rankings;
CREATE POLICY report_condition_fly_rankings_anon_upsert ON public.report_condition_fly_rankings
    FOR ALL USING (true) WITH CHECK (true);