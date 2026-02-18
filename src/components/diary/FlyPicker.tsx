import { useState, useEffect, useMemo } from "react";
import DiaryAutocomplete, { AutocompleteOption } from "./DiaryAutocomplete";
import { getRefFlies } from "@/services/diaryService";

interface FlyPickerProps {
  label?: string;
  value: string | null;
  onChange: (value: string) => void;
  currentStyle?: string | null;
  venueType?: 'stillwater' | 'river';
  required?: boolean;
}

// Map fishing style to fly top_category for tree guidance
const STYLE_TO_FLY_CATEGORY: Record<string, string[]> = {
  'Buzzer': ['Buzzer'],
  'Dry': ['Dry'],
  'Dry-Dropper': ['Dry', 'Nymph'],
  'Euro Nymph': ['Nymph'],
  'Lure': ['Lure'],
  'Lure + Nymph': ['Lure', 'Nymph'],
  'Nymph': ['Nymph'],
  'Nymph/Buzzer': ['Nymph', 'Buzzer'],
  'Wet': ['Wet'],
};

export default function FlyPicker({
  label = "Fly Pattern",
  value,
  onChange,
  currentStyle,
  venueType,
  required = false,
}: FlyPickerProps) {
  const [flies, setFlies] = useState<{
    pattern_name: string | null;
    top_category: string | null;
    sub_category: string | null;
    hook_size_min: string | null;
    hook_size_max: string | null;
    water_type: string | null;
  }[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const data = await getRefFlies(
          venueType ? { waterType: venueType === 'stillwater' ? 'Stillwater' : 'River' } : undefined
        );
        setFlies(data || []);
      } catch (err) {
        console.error('Failed to load flies:', err);
      }
    }
    load();
  }, [venueType]);

  const options: AutocompleteOption[] = useMemo(() => {
    const matchCategories = currentStyle
      ? STYLE_TO_FLY_CATEGORY[currentStyle] || []
      : [];

    return flies
      .filter(f => f.pattern_name)
      .map(f => ({
        value: f.pattern_name!,
        label: f.pattern_name!,
        matched: matchCategories.length > 0 && f.top_category
          ? matchCategories.includes(f.top_category)
          : undefined,
        category: f.top_category || undefined,
        meta: f.hook_size_min && f.hook_size_max
          ? `Hook ${f.hook_size_min}–${f.hook_size_max}`
          : undefined,
      }));
  }, [flies, currentStyle]);

  return (
    <DiaryAutocomplete
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      placeholder="Search fly patterns..."
      showAllLabel="Show all flies"
      required={required}
    />
  );
}
