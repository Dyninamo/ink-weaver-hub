import { useState, useEffect, useMemo, useRef } from "react";
import {
  getFlyTree,
  searchFlies,
  getVenueWaterTypeId,
  defaultCategoryForStyle,
  WATER_TYPE_LABELS,
  MONTH_LABELS,
  SINKING_LINES,
  type FlyWithSuitability,
  type Suitability,
} from "@/services/flyService";

interface FlyPickerProps {
  value: string | null;
  onChange: (value: string) => void;
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

  // Tree data (browse mode)
  const [tree, setTree] = useState<{
    main: FlyWithSuitability[];
    secondary: FlyWithSuitability[];
    occasional: FlyWithSuitability[];
    other: FlyWithSuitability[];
  } | null>(null);
  // No-water-type fallback: all flies of a category as one list
  const [flatBrowse, setFlatBrowse] = useState<FlyWithSuitability[] | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);

  useEffect(() => {
    if (debouncedQuery) return;
    if (resolvingWater) return;
    let cancelled = false;
    setLoadingTree(true);
    setTree(null);
    setFlatBrowse(null);

    if (waterTypeId == null) {
      // Fetch all flies in category as a single unbanded list (suitability = 'never').
      searchFlies({ query: "", waterTypeId: null, month }) // empty query returns []
        .catch(() => [])
        .then(() => {
          // Use a quick category-only fetch via getFlyTree with arbitrary water type wouldn't work;
          // do a direct search with no query is empty → use a tiny helper: reuse searchFlies-like
          // approach by importing nothing extra. Instead, just call getFlyTree with a sentinel
          // water type id (0) which will yield 0 monthly matches -> all flies fall into 'other'.
          return import("@/services/flyService").then((m) =>
            m.getFlyTree({ waterTypeId: 0, month, category })
          );
        })
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
  }, [debouncedQuery, waterTypeId, month, category, resolvingWater]);

  // Search results
  const [searchResults, setSearchResults] = useState<
    (FlyWithSuitability & { aliasMatch?: string })[]
  >([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  useEffect(() => {
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
  }, [debouncedQuery, waterTypeId, month]);

  // Collapsible bands in browse mode
  const [showOccasional, setShowOccasional] = useState(false);
  const [showOther, setShowOther] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const monthLabel = MONTH_LABELS[month - 1];
  const waterLabel = waterTypeId ? WATER_TYPE_LABELS[waterTypeId] : null;

  const handlePick = (fly: FlyWithSuitability) => {
    onChange(fly.name);
  };

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

      {value && (
        <div className="fp-current">
          Selected: <strong>{value}</strong>
        </div>
      )}
    </div>
  );
}
