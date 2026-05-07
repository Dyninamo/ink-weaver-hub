-- user_preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  size_mode TEXT NOT NULL DEFAULT 'weight' CHECK (size_mode IN ('weight','length')),
  size_unit TEXT NOT NULL DEFAULT 'lb' CHECK (size_unit IN ('lb','kg','in','cm')),
  default_species_stillwater TEXT NOT NULL DEFAULT 'Rainbow',
  default_species_river TEXT NOT NULL DEFAULT 'Brown',
  default_outcome TEXT NOT NULL DEFAULT 'released' CHECK (default_outcome IN ('kept','released')),
  default_retrieve TEXT,
  confirm_mode TEXT NOT NULL DEFAULT 'full' CHECK (confirm_mode IN ('full','abbreviated','auto')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read their own preferences"
  ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert their own preferences"
  ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update their own preferences"
  ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_user_preferences_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_preferences_updated_at();

-- user_presets
CREATE TABLE IF NOT EXISTS public.user_presets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rod JSONB NOT NULL,
  water_type TEXT,
  include_flies BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_presets_user_id_idx
  ON public.user_presets (user_id, last_used_at DESC);

ALTER TABLE public.user_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read their own presets"
  ON public.user_presets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert their own presets"
  ON public.user_presets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update their own presets"
  ON public.user_presets FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete their own presets"
  ON public.user_presets FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_user_presets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS user_presets_updated_at ON public.user_presets;
CREATE TRIGGER user_presets_updated_at
  BEFORE UPDATE ON public.user_presets
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_presets_updated_at();

NOTIFY pgrst, 'reload schema';