-- Drop temporary anon-read policies (from prompt 116) if present
DROP POLICY IF EXISTS "tmp_anon_read_groups"   ON public.fishery_groups;
DROP POLICY IF EXISTS "tmp_anon_read_managers" ON public.fishery_managers;
DROP POLICY IF EXISTS "tmp_anon_read_stock"    ON public.stocking_events;

-- Drop interim policies + helpers from prompt 117 lockdown so we can reapply spec-aligned versions
DROP POLICY IF EXISTS "fishery_managers self read" ON public.fishery_managers;
DROP POLICY IF EXISTS "fishery_groups auth read"   ON public.fishery_groups;
DROP POLICY IF EXISTS "stocking_events read"   ON public.stocking_events;
DROP POLICY IF EXISTS "stocking_events insert" ON public.stocking_events;
DROP POLICY IF EXISTS "stocking_events update" ON public.stocking_events;
DROP POLICY IF EXISTS "stocking_events delete" ON public.stocking_events;
DROP FUNCTION IF EXISTS public.has_manager_venue_access(text);
DROP FUNCTION IF EXISTS public.has_manager_read_access(text);

-- Helper: which venues can the current user MANAGE (read)?
CREATE OR REPLACE FUNCTION public.current_user_managed_venue_ids()
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT scope_id::text AS venue_id
    FROM public.fishery_managers
   WHERE user_id = auth.uid()
     AND status = 'active'
     AND scope_type = 'venue'
  UNION
  SELECT v.venue_id
    FROM public.fishery_managers fm
    JOIN public.venues_new v ON v.group_id::text = fm.scope_id
   WHERE fm.user_id = auth.uid()
     AND fm.status = 'active'
     AND fm.scope_type = 'group'
$$;

-- Helper: which venues can the current user WRITE to?
CREATE OR REPLACE FUNCTION public.current_user_writable_venue_ids()
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT scope_id::text
    FROM public.fishery_managers
   WHERE user_id = auth.uid()
     AND status = 'active'
     AND scope_type = 'venue'
     AND role IN ('owner', 'head_bailiff', 'bailiff')
$$;

-- fishery_groups: read groups whose venues the user manages
CREATE POLICY "managers_read_own_groups"
  ON public.fishery_groups
  FOR SELECT
  TO authenticated
  USING (
    id::text IN (
      SELECT scope_id FROM public.fishery_managers
       WHERE user_id = auth.uid() AND status = 'active' AND scope_type = 'group'
    )
    OR id IN (
      SELECT v.group_id FROM public.venues_new v
       WHERE v.venue_id IN (SELECT public.current_user_managed_venue_ids())
         AND v.group_id IS NOT NULL
    )
  );

-- fishery_managers: read own grants only
CREATE POLICY "managers_read_own_grants"
  ON public.fishery_managers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- stocking_events: read for any active manager of the venue
CREATE POLICY "managers_read_venue_stock"
  ON public.stocking_events
  FOR SELECT
  TO authenticated
  USING (venue_id IN (SELECT public.current_user_managed_venue_ids()));

-- stocking_events: insert only by venue-scope writers
CREATE POLICY "managers_insert_venue_stock"
  ON public.stocking_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    venue_id IN (SELECT public.current_user_writable_venue_ids())
    AND created_by IN (
      SELECT id FROM public.fishery_managers
       WHERE user_id = auth.uid()
         AND status = 'active'
         AND scope_type = 'venue'
         AND scope_id = stocking_events.venue_id
    )
  );

-- stocking_events: update by creator or venue owner
CREATE POLICY "managers_update_venue_stock"
  ON public.stocking_events
  FOR UPDATE
  TO authenticated
  USING (
    venue_id IN (SELECT public.current_user_writable_venue_ids())
    AND (
      created_by IN (SELECT id FROM public.fishery_managers WHERE user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.fishery_managers
         WHERE user_id = auth.uid()
           AND status = 'active'
           AND scope_type = 'venue'
           AND scope_id = stocking_events.venue_id
           AND role = 'owner'
      )
    )
  )
  WITH CHECK (
    venue_id IN (SELECT public.current_user_writable_venue_ids())
  );

-- stocking_events: delete same as update
CREATE POLICY "managers_delete_venue_stock"
  ON public.stocking_events
  FOR DELETE
  TO authenticated
  USING (
    venue_id IN (SELECT public.current_user_writable_venue_ids())
    AND (
      created_by IN (SELECT id FROM public.fishery_managers WHERE user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.fishery_managers
         WHERE user_id = auth.uid()
           AND status = 'active'
           AND scope_type = 'venue'
           AND scope_id = stocking_events.venue_id
           AND role = 'owner'
      )
    )
  );