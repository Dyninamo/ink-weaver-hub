DELETE FROM session_events WHERE session_id IN (
  SELECT id FROM fishing_sessions
  WHERE source = 'diary'
  AND (venue_name LIKE '%Test%' OR venue_name LIKE '%Probe%'
       OR venue_name LIKE '%Build Verification%' OR venue_name = 'test'
       OR venue_name = 'Unknown')
  AND session_date < '2099-01-01'
);

DELETE FROM fishing_sessions
WHERE source = 'diary'
AND (venue_name LIKE '%Test%' OR venue_name LIKE '%Probe%'
     OR venue_name LIKE '%Build Verification%' OR venue_name = 'test'
     OR venue_name = 'Unknown')
AND session_date < '2099-01-01';