-- Prompt 116: Manager Portal DDL (venues_new PK is venue_id text)

CREATE TABLE public.fishery_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  contact_email   text,
  contact_phone   text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fishery_groups_slug ON public.fishery_groups(slug);

ALTER TABLE public.venues_new
  ADD COLUMN group_id uuid REFERENCES public.fishery_groups(id) ON DELETE SET NULL;
CREATE INDEX idx_venues_new_group ON public.venues_new(group_id);

CREATE TABLE public.fishery_managers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type      text NOT NULL CHECK (scope_type IN ('venue', 'group')),
  scope_id        text NOT NULL,
  role            text NOT NULL CHECK (role IN ('owner','head_bailiff','bailiff','secretary'))
                  DEFAULT 'owner',
  tier            text NOT NULL CHECK (tier IN ('free','founding')) DEFAULT 'free',
  invited_by      uuid REFERENCES auth.users(id),
  invited_at      timestamptz NOT NULL DEFAULT now(),
  accepted_at     timestamptz,
  status          text NOT NULL CHECK (status IN ('invited','active','suspended'))
                  DEFAULT 'invited',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope_type, scope_id)
);
CREATE INDEX idx_fishery_managers_user ON public.fishery_managers(user_id);
CREATE INDEX idx_fishery_managers_scope ON public.fishery_managers(scope_type, scope_id);
CREATE INDEX idx_fishery_managers_status ON public.fishery_managers(status);

CREATE TABLE public.stocking_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id                text NOT NULL REFERENCES public.venues_new(venue_id) ON DELETE CASCADE,
  date_stocked            date NOT NULL,
  species                 text NOT NULL CHECK (species IN (
                            'rainbow','brown','blue','tiger','brook',
                            'triploid_brown','triploid_rainbow',
                            'salmon_parr','sea_trout_smolt','other'
                          )),
  quantity                integer NOT NULL CHECK (quantity > 0),
  avg_weight_lb           numeric(5,2) NOT NULL CHECK (avg_weight_lb > 0),
  size_band               text GENERATED ALWAYS AS (
                            CASE
                              WHEN avg_weight_lb < 4  THEN '8oz-4lb'
                              WHEN avg_weight_lb < 7  THEN '4-7lb'
                              WHEN avg_weight_lb < 10 THEN '7-10lb'
                              ELSE '10lb+'
                            END
                          ) STORED,
  supplier_id             uuid,
  supplier_name           text,
  ea_permit_ref           text,
  cost_total              numeric(10,2),
  cost_estimate           numeric(10,2),
  distribution_summary    text,
  distribution_points     jsonb,
  triploid                boolean NOT NULL DEFAULT false,
  notes                   text,
  created_by              uuid NOT NULL REFERENCES public.fishery_managers(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stocking_events_venue ON public.stocking_events(venue_id);
CREATE INDEX idx_stocking_events_date ON public.stocking_events(date_stocked);
CREATE INDEX idx_stocking_events_venue_date ON public.stocking_events(venue_id, date_stocked DESC);

ALTER TABLE public.fishery_groups   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fishery_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stocking_events  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tmp_anon_read_groups"   ON public.fishery_groups   FOR SELECT TO anon USING (true);
CREATE POLICY "tmp_anon_read_managers" ON public.fishery_managers FOR SELECT TO anon USING (true);
CREATE POLICY "tmp_anon_read_stock"    ON public.stocking_events  FOR SELECT TO anon USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_fishery_groups_updated   BEFORE UPDATE ON public.fishery_groups   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_fishery_managers_updated BEFORE UPDATE ON public.fishery_managers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_stocking_events_updated  BEFORE UPDATE ON public.stocking_events  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();