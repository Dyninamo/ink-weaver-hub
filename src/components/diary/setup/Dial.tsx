import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface DialOption {
  value: number;
  label: string;
}

interface DialProps {
  options: DialOption[];
  value: number | null;
  onChange: (v: number) => void;
  ariaLabel?: string;
  ariaValueText?: (v: number) => string;
}

/**
 * Horizontal scroll-snap dial. Center chip is "selected".
 * Mirrors RN's FishingDiary/src/components/Dial.tsx.
 */
export default function Dial({ options, value, onChange, ariaLabel, ariaValueText }: DialProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const ignoreScrollRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  // Centre the active chip on mount / value change
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc || value == null) return;
    const node = itemsRef.current.get(value);
    if (!node) return;
    ignoreScrollRef.current = true;
    const target = node.offsetLeft + node.offsetWidth / 2 - sc.clientWidth / 2;
    sc.scrollTo({ left: target, behavior: "smooth" });
    window.setTimeout(() => { ignoreScrollRef.current = false; }, 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleScroll() {
    if (ignoreScrollRef.current) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const sc = scrollerRef.current;
      if (!sc) return;
      const center = sc.scrollLeft + sc.clientWidth / 2;
      let bestVal: number | null = null;
      let bestDist = Infinity;
      itemsRef.current.forEach((node, val) => {
        const nodeCenter = node.offsetLeft + node.offsetWidth / 2;
        const dist = Math.abs(nodeCenter - center);
        if (dist < bestDist) { bestDist = dist; bestVal = val; }
      });
      if (bestVal !== null && bestVal !== value) onChange(bestVal);
    }, 80);
  }

  const min = options[0]?.value ?? 0;
  const max = options[options.length - 1]?.value ?? 0;

  return (
    <div
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value != null && ariaValueText ? ariaValueText(value) : undefined}
      className="relative"
    >
      {/* Centre indicator */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[88px] rounded-xl border-2 border-primary/40 bg-primary/5" />
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex gap-2 overflow-x-auto py-3 px-[calc(50%-44px)]"
        style={{
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              ref={(el) => {
                if (el) itemsRef.current.set(opt.value, el);
                else itemsRef.current.delete(opt.value);
              }}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              aria-label={opt.label}
              className={cn(
                "shrink-0 w-[80px] h-[56px] rounded-xl border text-sm font-medium transition-all",
                "flex items-center justify-center",
                active
                  ? "bg-primary text-primary-foreground border-primary scale-105 shadow-sm"
                  : "bg-card text-muted-foreground border-border opacity-60"
              )}
              style={{ scrollSnapAlign: "center" }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
