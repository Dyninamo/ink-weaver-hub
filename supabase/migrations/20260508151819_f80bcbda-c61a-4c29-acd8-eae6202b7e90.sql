ALTER TABLE public.fishing_sessions
  ADD COLUMN leader_material text,
  ADD COLUMN leader_length_ft real,
  ADD COLUMN leader_strength_lb real;

NOTIFY pgrst, 'reload schema';