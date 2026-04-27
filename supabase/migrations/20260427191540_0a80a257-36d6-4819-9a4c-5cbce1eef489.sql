DELETE FROM session_events WHERE session_id IN (
  SELECT id FROM fishing_sessions
  WHERE source = 'diary'
  AND (latitude IS NULL OR latitude = 0)
  AND session_date < '2099-01-01'
);

DELETE FROM fishing_sessions
WHERE source = 'diary'
AND (latitude IS NULL OR latitude = 0)
AND session_date < '2099-01-01';

INSERT INTO fishing_sessions (
  id, source, source_id, venue_name, venue_id, venue_type,
  session_date, start_time, end_time, duration_minutes,
  fishing_type, rods, angler_name, is_active,
  latitude, longitude, end_latitude, end_longitude, gps_altitude,
  notes, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'diary', '00000000-0000-0000-0000-000000000001',
  '[TEST] Grafham Water', 'TEST-GRAFHAM', 'stillwater',
  '2099-01-01', '2099-01-01T09:00:00', '2099-01-01T15:30:00', 390,
  'Bank', 1, 'Test', false,
  52.298, -0.3284, 52.300, -0.3294, 75.0,
  'TEST SESSION - do not include in analysis',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO fishing_sessions (
  id, source, source_id, venue_name, venue_type,
  session_date, start_time, end_time, duration_minutes,
  fishing_type, rods, angler_name, is_active,
  latitude, longitude, end_latitude, end_longitude, gps_altitude,
  notes, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'diary', '00000000-0000-0000-0000-000000000002',
  '[TEST] River Usk', 'river',
  '2099-01-02', '2099-01-02T10:00:00', '2099-01-02T14:45:00', 285,
  'Bank', 1, 'Test', false,
  51.873, -3.121, 51.876, -3.120, 45.0,
  'TEST SESSION - do not include in analysis',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO session_events (id, session_id, event_type, sort_order, event_time, species, weight_lb, weight_oz, weight_display, fly_pattern, fly_size, rig_position, style, line_type, retrieve, latitude, longitude, event_temp, event_wind_speed, event_wind_dir, event_pressure, event_conditions)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'catch', 0, '2099-01-01T10:15:00', 'Rainbow', 2, 8, '2lb 8oz', 'Diawl Bach', 14, 'point', 'Nymph/Buzzer', 'Di-3', 'Slow retrieve', 52.299, -0.330, 11.5, 14.0, 220, 1018.0, 'Cloud 65%'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'blank', 1, '2099-01-01T11:30:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 52.298, -0.328, NULL, NULL, NULL, NULL, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'change', 2, '2099-01-01T11:35:00', NULL, NULL, NULL, NULL, NULL, NULL, 'point', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'catch', 3, '2099-01-01T12:45:00', 'Rainbow', 3, 0, '3lb', 'Black Buzzer', 12, 'point', 'Nymph/Buzzer', 'Di-3', 'Figure of eight', 52.297, -0.327, 12.0, 16.0, 230, 1016.5, 'Cloud 75%, Pressure falling'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'got_away', 4, '2099-01-01T14:00:00', NULL, NULL, NULL, NULL, 'Black Buzzer', NULL, 'point', NULL, NULL, NULL, 52.298, -0.328, NULL, NULL, NULL, NULL, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'catch', 5, '2099-01-01T14:40:00', 'Brown', 4, 4, '4lb 4oz', 'Black Buzzer', 12, 'point', 'Nymph/Buzzer', 'Di-3', 'Slow retrieve', 52.300, -0.331, 11.0, 12.0, 240, 1015.0, 'Rain 0.5mm, Cloud 85%, Pressure falling');

INSERT INTO session_events (id, session_id, event_type, sort_order, event_time, species, weight_lb, weight_oz, weight_display, length_inches, measurement_mode, fly_pattern, fly_size, rig_position, style, line_type, retrieve, latitude, longitude, event_temp, event_wind_speed, event_wind_dir, event_pressure, event_conditions, notes)
VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'catch', 0, '2099-01-02T10:50:00', 'Brown', 1, 4, '1lb 4oz', NULL, 'weight', 'Pheasant Tail', 16, 'point', 'Euro Nymph', 'Floating', NULL, 51.874, -3.121, 9.0, 8.0, 190, 1022.0, 'Cloud 40%', NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'catch', 1, '2099-01-02T11:30:00', 'Brown', NULL, NULL, '28cm', 11, 'length', 'Hares Ear', 14, 'point', 'Euro Nymph', 'Floating', NULL, 51.875, -3.120, 10.0, 6.0, 200, 1022.5, 'Cloud 30%', NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'got_away', 2, '2099-01-02T12:15:00', NULL, NULL, NULL, NULL, NULL, NULL, 'Hares Ear', NULL, 'point', NULL, NULL, NULL, 51.875, -3.121, NULL, NULL, NULL, NULL, NULL, 'Missed the strike'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'change', 3, '2099-01-02T13:00:00', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'point', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'catch', 4, '2099-01-02T13:40:00', 'Grayling', 1, 8, '1lb 8oz', NULL, 'weight', 'March Brown Spider', 14, 'point', 'Wet', 'Floating', 'Dead drift', 51.876, -3.120, 10.5, 5.0, 180, 1023.0, 'Cloud 20%', 'Lovely rise in the tail of the pool');

UPDATE session_events
SET blank_confidence = 'Had follows', blank_reason = 'Wrong flies'
WHERE session_id = '00000000-0000-0000-0000-000000000001' AND event_type = 'blank';

UPDATE session_events
SET change_from = to_jsonb('Diawl Bach'::text), change_to = to_jsonb('Black Buzzer'::text)
WHERE session_id = '00000000-0000-0000-0000-000000000001' AND event_type = 'change';

UPDATE session_events
SET change_from = to_jsonb('Hares Ear'::text), change_to = to_jsonb('March Brown Spider'::text)
WHERE session_id = '00000000-0000-0000-0000-000000000002' AND event_type = 'change';