CREATE TABLE public.fly_suitability_truth (
    fly_name TEXT NOT NULL,
    water_type_id INTEGER NOT NULL,
    month INTEGER NOT NULL,
    suitability TEXT NOT NULL,
    generated_at TEXT,
    PRIMARY KEY (fly_name, water_type_id, month)
);

CREATE INDEX idx_fst_fly ON public.fly_suitability_truth(fly_name);
CREATE INDEX idx_fst_water_month ON public.fly_suitability_truth(water_type_id, month);

ALTER TABLE public.fly_suitability_truth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read fly suitability truth"
  ON public.fly_suitability_truth
  FOR SELECT
  USING (true);