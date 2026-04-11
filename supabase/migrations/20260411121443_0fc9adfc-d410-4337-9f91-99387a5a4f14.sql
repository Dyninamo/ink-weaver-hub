
CREATE POLICY "Public can read diary sessions"
  ON fishing_sessions FOR SELECT
  USING (source = 'diary');

CREATE POLICY "Public can read diary session events"
  ON session_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fishing_sessions
      WHERE fishing_sessions.id = session_events.session_id
        AND fishing_sessions.source = 'diary'
    )
  );
