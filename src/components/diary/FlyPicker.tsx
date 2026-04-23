import { useState, useEffect, useMemo, useRef } from "react";
import {
  getFlyTree,
  searchFlies,
  getVenueWaterTypeId,
  defaultCategoryForStyle,
  composeFlyDisplayName,
  WATER_TYPE_LABELS,
  MONTH_LABELS,
  SINKING_LINES,
  type FlyWithSuitability,
  type Suitability,
} from "@/services/flyService";

export interface FlyPickerResult {
  pattern: string;
  size: number | null;
}

interface FlyPickerProps {
  value: string | null;
  /** Now receives composed pattern + chosen hook size. */
  onChange: (result: FlyPickerResult) => void;
  currentStyle?: string | null;
  currentLine?: string | null;
  /** Optional explicit water_type_id (1-7). Falls back to venueName lookup. */
  waterTypeId?: number | null;
  /** Used to look up water_type_id when not passed explicitly. */
  venueName?: string | null;
  /** Defaults to current month. */
  currentMonth?: number;
  // legacy props (still accepted, ignored)
  label?: string;
  required?: boolean;
  venueType?: "stillwater" | "river";
}

const ALL_CATEGORIES = ["Dry", "Nymph", "Wet", "Lure", "Buzzer", "Other"];

function suitabilityBadge(s: Suitability) {
  switch (s) {
    case "main":
      return { label: "prime", dot: "var(--event-catch-dark)", color: "var(--event-catch-dark)" };
    case "secondary":
      return { label: "secondary", dot: "var(--gild-500)", color: "var(--gild-700)" };
    case "occasional":
      return { label: "occasional", dot: "var(--ink-300)", color: "var(--ink-500)" };
    case "never":
      return { label: "off-season", dot: "var(--event-lost)", color: "var(--event-lost)" };
  }
}

function FlyRow({
  fly,
  onClick,
  showStripe,
  showDot,
  showEvidenceChip,
  badge,
  muted,
  aliasMatch,
}: {
  fly: FlyWithSuitability;
  onClick: () => void;
  showStripe?: boolean;
  showDot?: boolean;
  showEvidenceChip?: boolean;
  badge?: ReturnType<typeof suitabilityBadge>;
  muted?: boolean;
  aliasMatch?: string;
}) {
  const sub: string[] = [];
  if (fly.sub_category) sub.push(fly.sub_category);
  if (fly.hook_size_min != null && fly.hook_size_max != null) {
    sub.push(`hook ${fly.hook_size_min}–${fly.hook_size_max}`);
  } else if (fly.hook_size_min != null) {
    sub.push(`hook ${fly.hook_size_min}`);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="fp-row"
      style={{
        borderLeft: showStripe ? "3px solid var(--event-catch)" : "3px solid transparent",
      }}
    >
      <div className="fp-row-main">
        <div className="fp-row-name">
          {showDot && <span className="fp-dot" aria-hidden />}
          <span style={{ color: muted ? "var(--ink-500)" : "var(--ink-900)" }}>{fly.name}</span>
        </div>
        {(sub.length > 0 || aliasMatch) && (
          <div className="fp-row-sub">
            {aliasMatch && (
              <span style={{ color: "var(--ink-500)" }}>
                alias “{aliasMatch}” → {fly.name}
              </span>
            )}
            {!aliasMatch && sub.join(" · ")}
          </div>
        )}
      </div>
      {showEvidenceChip && fly.evidence_count > 0 && (
        <span className="fp-evidence">{fly.evidence_count}</span>
      )}
      {badge && (
        <div className="fp-badge" style={{ color: badge.color }}>
          <span className="fp-badge-dot" style={{ background: badge.dot }} aria-hidden />
          {badge.label}
        </div>
      )}
    </button>
  );
}

function SkeletonRows() {
  return (
    <div className="fp-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="fp-skel-row" />
      ))}
    </div>
  );
}

// ---------- Qualifier chip row ----------

function ChipRow({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: string[];
  value: string | null;
  onSelect: (v: string) => void;
}) {
  return (
    <>
      <div className="fp-qual-label">{label}</div>
      <div className="fp-chip-row">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className="fp-chip"
            data-active={value === opt}
            onClick={() => onSelect(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </>
  );
}

// ---------- main component ----------

export default function FlyPicker({
  value,
  onChange,
  currentStyle,
  currentLine,
  waterTypeId: waterTypeIdProp,
  venueName,
  currentMonth,
}: FlyPickerProps) {
  const month = currentMonth ?? new Date().getMonth() + 1;
  const [waterTypeId, setWaterTypeId] = useState<number | null>(waterTypeIdProp ?? null);
  const [resolvingWater, setResolvingWater] = useState(waterTypeIdProp == null && !!venueName);

  // Resolve water type from venue if not provided
  useEffect(() => {
    let cancelled = false;
    if (waterTypeIdProp != null) {
      setWaterTypeId(waterTypeIdProp);
      setResolvingWater(false);
      return;
    }
    if (!venueName) {
      setWaterTypeId(null);
      setResolvingWater(false);
      return;
    }
    setResolvingWater(true);
    getVenueWaterTypeId(venueName)
      .then((id) => {
        if (!cancelled) setWaterTypeId(id);
      })
      .catch(() => {
        if (!cancelled) setWaterTypeId(null);
      })
      .finally(() => {
        if (!cancelled) setResolvingWater(false);
      });
    return () => {
      cancelled = true;
    };
  }, [waterTypeIdProp, venueName]);

  // Sinking-line filter
  const hideDryTab = currentLine ? SINKING_LINES.has(currentLine) : false;
  const visibleCategories = useMemo(
    () => ALL_CATEGORIES.filter((c) => !(hideDryTab && c === "Dry")),
    [hideDryTab]
  );

  // Default-selected category from rod style
  const [category, setCategory] = useState<string>(() => {
    const def = defaultCategoryForStyle(currentStyle);
    if (def === "Dry" && hideDryTab) return "Nymph";
    return def;
  });
  useEffect(() => {
    if (hideDryTab && category === "Dry") setCategory("Nymph");
  }, [hideDryTab, category]);

  // Search
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput), 150);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Two-step state
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedFly, setSelectedFly] = useState<FlyWithSuitability | null>(null);

  // Qualifier state — reset when selectedFly changes
  const [colour, setColour] = useState<string | null>(null);
  const [accent, setAccent] = useState<string | null>(null);
  const [weight, setWeight] = useState<string | null>(null);
  const [hookStyle, setHookStyle] = useState<string | null>(null);
  const [hookSize, setHookSize] = useState<number | null>(null);

  // Tree data (browse mode)
  const [tree, setTree] = useState<{
    main: FlyWithSuitability[];
    secondary: FlyWithSuitability[];
    occasional: FlyWithSuitability[];
    other: FlyWithSuitability[];
  } | null>(null);
  const [flatBrowse, setFlatBrowse] = useState<FlyWithSuitability[] | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);

  useEffect(() => {
    if (step !== 1) return;
    if (debouncedQuery) return;
    if (resolvingWater) return;
    let cancelled = false;
    setLoadingTree(true);
    setTree(null);
    setFlatBrowse(null);

    if (waterTypeId == null) {
      import("@/services/flyService")
        .then((m) => m.getFlyTree({ waterTypeId: 0, month, category }))
        .then((res) => {
          if (cancelled) return;
          const all = [...res.main, ...res.secondary, ...res.occasional, ...res.other].sort(
            (a, b) => a.name.localeCompare(b.name)
          );
          setFlatBrowse(all);
        })
        .finally(() => {
          if (!cancelled) setLoadingTree(false);
        });
      return () => {
        cancelled = true;
      };
    }

    getFlyTree({ waterTypeId, month, category })
      .then((res) => {
        if (!cancelled) setTree(res);
      })
      .catch((err) => {
        console.error("FlyPicker: getFlyTree failed", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingTree(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, waterTypeId, month, category, resolvingWater, step]);

  // Search results
  const [searchResults, setSearchResults] = useState<
    (FlyWithSuitability & { aliasMatch?: string })[]
  >([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  useEffect(() => {
    if (step !== 1) return;
    if (!debouncedQuery) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setLoadingSearch(true);
    searchFlies({ query: debouncedQuery, waterTypeId, month })
      .then((rows) => {
        if (!cancelled) setSearchResults(rows);
      })
      .catch((err) => console.error("FlyPicker: searchFlies failed", err))
      .finally(() => {
        if (!cancelled) setLoadingSearch(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, waterTypeId, month, step]);

  // Collapsible bands in browse mode
  const [showOccasional, setShowOccasional] = useState(false);
  const [showOther, setShowOther] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const monthLabel = MONTH_LABELS[month - 1];
  const waterLabel = waterTypeId ? WATER_TYPE_LABELS[waterTypeId] : null;

  // ---------- Step 2 init ----------

  // Compute the hook-size range (chips) and middle default.
  const hookSizes: number[] = useMemo(() => {
    if (!selectedFly) return [];
    const min = selectedFly.hook_size_min;
    const max = selectedFly.hook_size_max;
    if (min == null && max == null) return [];
    const lo = Math.min(min ?? max!, max ?? min!);
    const hi = Math.max(min ?? max!, max ?? min!);
    // Hook sizes — even integers in this range, descending feel doesn't matter; just enumerate.
    const arr: number[] = [];
    for (let s = lo; s <= hi; s += 2) arr.push(s);
    if (arr.length === 0) arr.push(lo);
    return arr;
  }, [selectedFly]);

  // Render-decision flags
  const showColourRow = !!selectedFly && selectedFly.colours.length > 1;
  const accentOptions = useMemo(() => {
    if (!selectedFly || selectedFly.accents.length === 0) return [];
    return ["none", ...selectedFly.accents];
  }, [selectedFly]);
  const showAccentRow = accentOptions.length > 0;
  const showWeightRow = !!selectedFly && selectedFly.weights.length > 1;
  const showHookStyleRow = !!selectedFly && selectedFly.hook_styles.length > 1;

  // Initialise qualifier state when a new fly is picked.
  useEffect(() => {
    if (!selectedFly) return;
    // Colour
    if (selectedFly.colours.length === 0) setColour(null);
    else setColour(selectedFly.colours[0]);
    // Accent — default "none" when row will render, else null
    if (selectedFly.accents.length === 0) setAccent(null);
    else setAccent("none");
    // Weight
    if (selectedFly.weights.length === 0) setWeight(null);
    else setWeight(selectedFly.weights[0]);
    // Hook style: prefer barbless, else standard, else first
    const styles = selectedFly.hook_styles;
    if (styles.length === 0) setHookStyle(null);
    else if (styles.includes("barbless")) setHookStyle("barbless");
    else if (styles.includes("standard")) setHookStyle("standard");
    else setHookStyle(styles[0]);
    // Hook size — middle of min..max (rounded down on even step)
    if (hookSizes.length > 0) {
      const mid = hookSizes[Math.floor(hookSizes.length / 2)];
      setHookSize(mid);
    } else {
      setHookSize(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFly]);

  // Composed name (live)
  const composed = useMemo(() => {
    if (!selectedFly) return "";
    return composeFlyDisplayName({
      name: selectedFly.name,
      colour: colour,
      accent: accent,
      weight: weight,
    });
  }, [selectedFly, colour, accent, weight]);

  const ctaLabel = useMemo(() => {
    if (!selectedFly) return "";
    const sizePart = hookSize != null ? ` · #${hookSize}` : "";
    return `Add ${composed}${sizePart}`;
  }, [composed, hookSize, selectedFly]);

  const handlePick = (fly: FlyWithSuitability) => {
    setSelectedFly(fly);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setSelectedFly(null);
    // search/category state preserved deliberately
  };

  const handleConfirm = () => {
    if (!selectedFly) return;
    onChange({ pattern: composed, size: hookSize });
  };

  // ============================================================
  // STEP 2 render
  // ============================================================
  if (step === 2 && selectedFly) {
    return (
      <div className="fp-step2">
        <div className="fp-step2-header">
          <button
            type="button"
            className="fp-back"
            aria-label="Back to fly list"
            onClick={handleBack}
          >
            ‹
          </button>
          <div className="fp-step2-title">{selectedFly.name}</div>
        </div>

        <div className="fp-step2-body">
          {showColourRow && (
            <ChipRow
              label="Colour"
              options={selectedFly.colours}
              value={colour}
              onSelect={setColour}
            />
          )}

          {showAccentRow && (
            <ChipRow
              label="Accent"
              options={accentOptions}
              value={accent}
              onSelect={setAccent}
            />
          )}

          {showWeightRow && (
            <ChipRow
              label="Weight"
              options={selectedFly.weights}
              value={weight}
              onSelect={setWeight}
            />
          )}

          {showHookStyleRow && (
            <ChipRow
              label="Hook style"
              options={selectedFly.hook_styles}
              value={hookStyle}
              onSelect={setHookStyle}
            />
          )}

          {hookSizes.length > 0 && (
            <>
              <div className="fp-qual-label">Hook size</div>
              <div className="fp-chip-row">
                {hookSizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="fp-chip"
                    data-active={hookSize === s}
                    onClick={() => setHookSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="fp-composed">
            <span className="fp-composed-label">Composed:</span>{" "}
            <strong>{composed}</strong>
          </div>
        </div>

        <div className="fp-step2-footer">
          <button
            type="button"
            className="fp-cta"
            onClick={handleConfirm}
            disabled={!composed}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // STEP 1 render
  // ============================================================
  return (
    <div className="fp-root">
      {/* Tabs */}
      {!debouncedQuery && (
        <div className="fp-tabs" role="tablist">
          {visibleCategories.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              className="fp-tab"
              data-active={category === c}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Search pill */}
      <div className="fp-search">
        <span className="fp-search-icon" aria-hidden>⌕</span>
        <input
          ref={inputRef}
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search 549 patterns…"
          className="fp-search-input"
        />
        {searchInput && (
          <button
            type="button"
            className="fp-search-clear"
            aria-label="Clear search"
            onClick={() => {
              setSearchInput("");
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* No-water-type tip banner */}
      {!debouncedQuery && waterTypeId == null && !resolvingWater && (
        <div className="fp-tip">
          Tip: select a venue for monthly fly suggestions.
        </div>
      )}

      {/* Body */}
      <div className="fp-body">
        {/* Search mode */}
        {debouncedQuery && (
          <>
            {loadingSearch && <SkeletonRows />}
            {!loadingSearch && searchResults.length === 0 && (
              <div className="fp-empty">No matches for “{debouncedQuery}”.</div>
            )}
            {!loadingSearch &&
              searchResults.map((fly) => (
                <FlyRow
                  key={fly.id}
                  fly={fly}
                  onClick={() => handlePick(fly)}
                  badge={suitabilityBadge(fly.suitability)}
                  aliasMatch={fly.aliasMatch}
                />
              ))}
          </>
        )}

        {/* Browse mode — tree */}
        {!debouncedQuery && waterTypeId != null && (
          <>
            {(loadingTree || !tree) && <SkeletonRows />}
            {!loadingTree && tree && (
              <>
                {tree.main.length > 0 && (
                  <section className="fp-band">
                    <h4 className="fp-band-header fp-band-header-prime">
                      Prime for {monthLabel} · {waterLabel}
                    </h4>
                    {tree.main.map((fly) => (
                      <FlyRow
                        key={fly.id}
                        fly={fly}
                        onClick={() => handlePick(fly)}
                        showStripe
                        showDot
                        showEvidenceChip
                      />
                    ))}
                  </section>
                )}

                {tree.secondary.length > 0 && (
                  <section className="fp-band">
                    <h4 className="fp-band-header">Also worth trying</h4>
                    {tree.secondary.map((fly) => (
                      <FlyRow key={fly.id} fly={fly} onClick={() => handlePick(fly)} />
                    ))}
                  </section>
                )}

                {tree.occasional.length > 0 && (
                  <section className="fp-band">
                    <button
                      type="button"
                      className="fp-band-toggle"
                      onClick={() => setShowOccasional((v) => !v)}
                    >
                      <span>Occasional ({tree.occasional.length})</span>
                      <span className="fp-chev" data-open={showOccasional}>›</span>
                    </button>
                    {showOccasional &&
                      tree.occasional.map((fly) => (
                        <FlyRow
                          key={fly.id}
                          fly={fly}
                          onClick={() => handlePick(fly)}
                          muted
                        />
                      ))}
                  </section>
                )}

                {tree.other.length > 0 && (
                  <section className="fp-band">
                    <button
                      type="button"
                      className="fp-band-toggle"
                      onClick={() => setShowOther((v) => !v)}
                    >
                      <span>All other {category} patterns ({tree.other.length})</span>
                      <span className="fp-chev" data-open={showOther}>›</span>
                    </button>
                    {showOther &&
                      tree.other.map((fly) => (
                        <FlyRow
                          key={fly.id}
                          fly={fly}
                          onClick={() => handlePick(fly)}
                          muted
                        />
                      ))}
                  </section>
                )}

                {tree.main.length + tree.secondary.length + tree.occasional.length + tree.other.length === 0 && (
                  <div className="fp-empty">No {category} patterns in the catalogue.</div>
                )}
              </>
            )}
          </>
        )}

        {/* Browse mode — no water type, flat list */}
        {!debouncedQuery && waterTypeId == null && (
          <>
            {(loadingTree || !flatBrowse) && <SkeletonRows />}
            {!loadingTree && flatBrowse && flatBrowse.length === 0 && (
              <div className="fp-empty">No {category} patterns in the catalogue.</div>
            )}
            {!loadingTree &&
              flatBrowse &&
              flatBrowse.map((fly) => (
                <FlyRow key={fly.id} fly={fly} onClick={() => handlePick(fly)} />
              ))}
          </>
        )}
      </div>

    </div>
  );
}
