UPDATE fishing_sessions
SET    is_active = false,
       updated_at = now()
WHERE  source = 'diary'
  AND  is_active = true;