
CREATE OR REPLACE FUNCTION public.update_diary_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE diary_entries SET
    total_fish = (SELECT COUNT(*) FROM diary_fish WHERE diary_entry_id = COALESCE(NEW.diary_entry_id, OLD.diary_entry_id)),
    total_kept = (SELECT COUNT(*) FROM diary_fish WHERE diary_entry_id = COALESCE(NEW.diary_entry_id, OLD.diary_entry_id) AND kept_or_released = 'Kept'),
    total_released = (SELECT COUNT(*) FROM diary_fish WHERE diary_entry_id = COALESCE(NEW.diary_entry_id, OLD.diary_entry_id) AND kept_or_released = 'Released'),
    methods_used = (SELECT COALESCE(jsonb_agg(DISTINCT f.method) FILTER (WHERE f.method IS NOT NULL), '[]') FROM diary_fish f WHERE f.diary_entry_id = COALESCE(NEW.diary_entry_id, OLD.diary_entry_id)),
    flies_used = (SELECT COALESCE(jsonb_agg(DISTINCT f.fly) FILTER (WHERE f.fly IS NOT NULL), '[]') FROM diary_fish f WHERE f.diary_entry_id = COALESCE(NEW.diary_entry_id, OLD.diary_entry_id)),
    spots_fished = (SELECT COALESCE(jsonb_agg(DISTINCT f.spot) FILTER (WHERE f.spot IS NOT NULL), '[]') FROM diary_fish f WHERE f.diary_entry_id = COALESCE(NEW.diary_entry_id, OLD.diary_entry_id)),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.diary_entry_id, OLD.diary_entry_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER diary_fish_changed
  AFTER INSERT OR UPDATE OR DELETE ON diary_fish
  FOR EACH ROW EXECUTE FUNCTION update_diary_totals();
