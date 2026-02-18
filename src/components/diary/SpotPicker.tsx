import { useState, useEffect, useMemo } from "react";
import DiaryAutocomplete, { AutocompleteOption } from "./DiaryAutocomplete";
import { getVenueSpots } from "@/services/diaryService";

interface SpotPickerProps {
  label?: string;
  value: string | null;
  onChange: (value: string) => void;
  venueName: string;
  required?: boolean;
}

export default function SpotPicker({
  label = "Spot",
  value,
  onChange,
  venueName,
  required = false,
}: SpotPickerProps) {
  const [spots, setSpots] = useState<{
    spot_name: string;
    access_type: string | null;
    notes: string | null;
  }[]>([]);

  useEffect(() => {
    if (!venueName) {
      setSpots([]);
      return;
    }
    async function load() {
      try {
        const data = await getVenueSpots(venueName);
        setSpots(data || []);
      } catch (err) {
        console.error('Failed to load spots:', err);
      }
    }
    load();
  }, [venueName]);

  const options: AutocompleteOption[] = useMemo(() =>
    spots.map(s => ({
      value: s.spot_name,
      label: s.spot_name,
      meta: s.access_type || undefined,
    })),
    [spots]
  );

  return (
    <DiaryAutocomplete
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      placeholder={
        spots.length === 0
          ? `No spots loaded for ${venueName}`
          : "Search spots..."
      }
      required={required}
    />
  );
}
