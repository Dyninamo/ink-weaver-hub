import { useState, useEffect, useCallback, useMemo } from "react";
import DiaryAutocomplete, { AutocompleteOption } from "./DiaryAutocomplete";
import {
  getRefRigs,
  getRefRetrieves,
  getRefLines,
  FISHING_STYLES,
  FRIENDLY_LINE_NAMES,
  NORMALISED_DEPTH_ZONES,
  normaliseDepthZone,
  type CurrentSetup,
} from "@/services/diaryService";

interface SetupCascadeProps {
  venueType: 'stillwater' | 'river';
  value: CurrentSetup;
  onChange: (setup: CurrentSetup) => void;
  compact?: boolean;  // true = horizontal layout for inline use
}

interface RefData {
  rigs: { rig_name: string; water_type: string; style: string; flies_on_rig: string | null; depth_zone: string | null }[];
  retrieves: { retrieve_name: string; water_type: string | null; style: string | null; pace: string | null; depth_zone: string | null }[];
  lines: { line_type_code: string | null; line_family: string | null; buoyancy: string | null; sink_rate_ips: string | null; friendly_name: string | null }[];
}

export default function SetupCascade({
  venueType,
  value,
  onChange,
  compact = false,
}: SetupCascadeProps) {
  const [refData, setRefData] = useState<RefData>({ rigs: [], retrieves: [], lines: [] });
  const [loading, setLoading] = useState(true);

  // Load reference data once
  useEffect(() => {
    async function loadRefs() {
      try {
        const [rigs, retrieves, lines] = await Promise.all([
          getRefRigs(),
          getRefRetrieves(),
          getRefLines(),
        ]);
        setRefData({
          rigs: (rigs || []) as RefData['rigs'],
          retrieves: (retrieves || []) as RefData['retrieves'],
          lines: (lines || []) as RefData['lines'],
        });
      } catch (err) {
        console.error('Failed to load reference data:', err);
      }
      setLoading(false);
    }
    loadRefs();
  }, []);

  // Helper: update a single field
  const updateField = useCallback((field: keyof CurrentSetup, val: string) => {
    onChange({ ...value, [field]: val });
  }, [value, onChange]);

  // === STYLE OPTIONS ===
  const styleOptions: AutocompleteOption[] = useMemo(() =>
    FISHING_STYLES.map(s => ({
      value: s,
      label: s,
    })),
    []
  );

  // === RIG OPTIONS (tree-guided by style + water type) ===
  const rigOptions: AutocompleteOption[] = useMemo(() => {
    const waterTypeLabel = venueType === 'stillwater' ? 'Stillwater' : 'River';
    return refData.rigs.map(r => ({
      value: r.rig_name,
      label: r.rig_name,
      matched: value.style
        ? r.style === value.style && (r.water_type === waterTypeLabel || r.water_type === 'Both')
        : undefined,
      category: r.style,
      meta: [r.flies_on_rig ? `${r.flies_on_rig} flies` : null, r.depth_zone].filter(Boolean).join(' · ') || undefined,
    }));
  }, [refData.rigs, value.style, venueType]);

  // === LINE OPTIONS (friendly names, guided by style) ===
  const lineOptions: AutocompleteOption[] = useMemo(() => {
    // For tree matching: certain styles typically use certain lines
    const styleLineHints: Record<string, string[]> = {
      'Buzzer': ['Floating', 'Midge Tip'],
      'Dry': ['Floating'],
      'Dry-Dropper': ['Floating'],
      'Euro Nymph': ['Euro Mono'],
      'Lure': ['Intermediate', 'Di-3', 'Di-5', 'Di-7', 'Fast Sink'],
      'Lure + Nymph': ['Intermediate', 'Di-3'],
      'Nymph': ['Floating', 'Midge Tip', 'Intermediate'],
      'Nymph/Buzzer': ['Floating', 'Midge Tip'],
      'Wet': ['Floating', 'Midge Tip', 'Intermediate'],
    };

    const matchedLines = value.style ? (styleLineHints[value.style] || []) : [];

    return FRIENDLY_LINE_NAMES.map(name => ({
      value: name,
      label: name,
      matched: value.style ? matchedLines.includes(name) : undefined,
    }));
  }, [refData.lines, value.style]);

  // === RETRIEVE OPTIONS (tree-guided by style) ===
  const retrieveOptions: AutocompleteOption[] = useMemo(() =>
    refData.retrieves.map(r => ({
      value: r.retrieve_name,
      label: r.retrieve_name,
      matched: value.style
        ? r.style === value.style
        : undefined,
      category: r.style || undefined,
      meta: [r.pace, r.depth_zone].filter(Boolean).join(' · ') || undefined,
    })),
    [refData.retrieves, value.style]
  );

  // === DEPTH ZONE OPTIONS (guided by rig selection) ===
  const depthOptions: AutocompleteOption[] = useMemo(() => {
    // If a rig is selected, its depth zone is the suggested default
    const rigDepth = value.rig
      ? refData.rigs.find(r => r.rig_name === value.rig)?.depth_zone
      : null;
    const normalisedRigDepth = rigDepth ? normaliseDepthZone(rigDepth) : null;

    return NORMALISED_DEPTH_ZONES.map(z => ({
      value: z,
      label: z,
      matched: normalisedRigDepth ? z === normalisedRigDepth : undefined,
    }));
  }, [value.rig, refData.rigs]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 bg-muted rounded-md" />
        ))}
      </div>
    );
  }

  const containerClass = compact
    ? "grid grid-cols-2 gap-3"
    : "space-y-4";

  return (
    <div className={containerClass}>
      <DiaryAutocomplete
        label="Style"
        value={value.style}
        options={styleOptions}
        onChange={(v) => updateField('style', v)}
        placeholder="Choose fishing style..."
        required
      />

      <DiaryAutocomplete
        label="Rig"
        value={value.rig}
        options={rigOptions}
        onChange={(v) => updateField('rig', v)}
        placeholder="Choose rig setup..."
        showAllLabel="Show all rigs"
      />

      <DiaryAutocomplete
        label="Line"
        value={value.line_type}
        options={lineOptions}
        onChange={(v) => updateField('line_type', v)}
        placeholder="Choose line type..."
        showAllLabel="Show all lines"
      />

      <DiaryAutocomplete
        label="Retrieve"
        value={value.retrieve}
        options={retrieveOptions}
        onChange={(v) => updateField('retrieve', v)}
        placeholder="Choose retrieve..."
        showAllLabel="Show all retrieves"
      />

      <DiaryAutocomplete
        label="Depth Zone"
        value={value.depth_zone}
        options={depthOptions}
        onChange={(v) => updateField('depth_zone', v)}
        placeholder="Choose depth zone..."
        showAllLabel="Show all depths"
      />
    </div>
  );
}
