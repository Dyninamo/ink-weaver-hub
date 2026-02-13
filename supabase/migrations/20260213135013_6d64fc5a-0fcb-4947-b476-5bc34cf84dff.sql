DELETE FROM public.verification_codes WHERE user_id = '2e1ca3fe-bcd1-481f-a396-f80a572a2b09';
DELETE FROM public.shared_reports WHERE created_by = '2e1ca3fe-bcd1-481f-a396-f80a572a2b09';
DELETE FROM public.queries WHERE user_id = '2e1ca3fe-bcd1-481f-a396-f80a572a2b09';
DELETE FROM public.user_profiles WHERE id = '2e1ca3fe-bcd1-481f-a396-f80a572a2b09';
DELETE FROM auth.users WHERE id = '2e1ca3fe-bcd1-481f-a396-f80a572a2b09';