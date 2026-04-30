-- Helper: does the current user have venue-scope (write) access to a given venue?
CREATE OR REPLACE FUNCTION public.has_manager_venue_access(p_venue_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fishery_managers fm
    WHERE fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND fm.scope_type = 'venue'
      AND fm.scope_id = p_venue_id
  );
$$;

-- Helper: read access (venue grant OR group grant covering this venue)
CREATE OR REPLACE FUNCTION public.has_manager_read_access(p_venue_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fishery_managers fm
    WHERE fm.user_id = auth.uid()
      AND fm.status = 'active'
      AND (
        (fm.scope_type = 'venue' AND fm.scope_id = p_venue_id)
        OR (fm.scope_type = 'group' AND fm.scope_id = (
          SELECT group_id::text FROM public.venues_new WHERE venue_id = p_venue_id
        ))
      )
  );
$$;

-- fishery_managers: authenticated users see ONLY their own grants
DROP POLICY IF EXISTS "fishery_managers public read" ON public.fishery_managers;
DROP POLICY IF EXISTS "fishery_managers self read" ON public.fishery_managers;
CREATE POLICY "fishery_managers self read"
  ON public.fishery_managers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- fishery_groups: any authenticated user may read groups (no sensitive data)
DROP POLICY IF EXISTS "fishery_groups public read" ON public.fishery_groups;
DROP POLICY IF EXISTS "fishery_groups auth read" ON public.fishery_groups;
CREATE POLICY "fishery_groups auth read"
  ON public.fishery_groups FOR SELECT
  TO authenticated, anon
  USING (true);

-- stocking_events policies
DROP POLICY IF EXISTS "stocking_events public read" ON public.stocking_events;
DROP POLICY IF EXISTS "stocking_events read" ON public.stocking_events;
DROP POLICY IF EXISTS "stocking_events insert" ON public.stocking_events;
DROP POLICY IF EXISTS "stocking_events update" ON public.stocking_events;
DROP POLICY IF EXISTS "stocking_events delete" ON public.stocking_events;

CREATE POLICY "stocking_events read"
  ON public.stocking_events FOR SELECT
  TO authenticated
  USING (public.has_manager_read_access(venue_id));

CREATE POLICY "stocking_events insert"
  ON public.stocking_events FOR INSERT
  TO authenticated
  WITH CHECK (public.has_manager_venue_access(venue_id));

CREATE POLICY "stocking_events update"
  ON public.stocking_events FOR UPDATE
  TO authenticated
  USING (public.has_manager_venue_access(venue_id))
  WITH CHECK (public.has_manager_venue_access(venue_id));

CREATE POLICY "stocking_events delete"
  ON public.stocking_events FOR DELETE
  TO authenticated
  USING (public.has_manager_venue_access(venue_id));