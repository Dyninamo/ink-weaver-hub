import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AutocompleteOption {
  value: string;
  label: string;
  matched?: boolean;    // true if this option matches the current tree context
  category?: string;    // for grouping (e.g. fly top_category)
  meta?: string;        // secondary text (e.g. depth zone, pace)
}

interface DiaryAutocompleteProps {
  label: string;
  value: string | null;
  options: AutocompleteOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  showAllLabel?: string;  // text for the divider, default "Show all"
}

export default function DiaryAutocomplete({
  label,
  value,
  options,
  onChange,
  placeholder = "Search or select...",
  required = false,
  disabled = false,
  showAllLabel = "Show all",
}: DiaryAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Split into matched (top) and unmatched (below divider), then filter by search
  const { matchedOptions, unmatchedOptions, hasMatched } = useMemo(() => {
    const searchLower = search.toLowerCase().trim();

    const filterBySearch = (opts: AutocompleteOption[]) =>
      searchLower
        ? opts.filter(o =>
            o.label.toLowerCase().includes(searchLower) ||
            (o.category && o.category.toLowerCase().includes(searchLower)) ||
            (o.meta && o.meta.toLowerCase().includes(searchLower))
          )
        : opts;

    const matched = filterBySearch(options.filter(o => o.matched === true));
    const unmatched = filterBySearch(options.filter(o => o.matched !== true));
    const hasAnyMatched = options.some(o => o.matched === true);

    return {
      matchedOptions: matched,
      unmatchedOptions: unmatched,
      hasMatched: hasAnyMatched,
    };
  }, [options, search]);

  // Flat list for keyboard navigation (matched + divider marker + unmatched)
  const flatList = useMemo(() => {
    const list: (AutocompleteOption | 'divider')[] = [...matchedOptions];
    if (hasMatched && unmatchedOptions.length > 0) {
      list.push('divider');
    }
    list.push(...unmatchedOptions);
    return list;
  }, [matchedOptions, unmatchedOptions, hasMatched]);

  const selectableItems = flatList.filter(item => item !== 'divider') as AutocompleteOption[];

  function handleSelect(option: AutocompleteOption) {
    onChange(option.value);
    setIsOpen(false);
    setSearch("");
    setHighlightIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex(prev =>
          prev < selectableItems.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex(prev =>
          prev > 0 ? prev - 1 : selectableItems.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < selectableItems.length) {
          handleSelect(selectableItems[highlightIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearch("");
        setHighlightIndex(-1);
        break;
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-selectable="true"]');
      items[highlightIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const displayValue = value
    ? options.find(o => o.value === value)?.label || value
    : "";

  return (
    <div ref={containerRef} className="relative">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {/* Trigger / search input */}
      <div
        className={cn(
          "flex items-center border rounded-md mt-1.5 transition-colors",
          isOpen ? "ring-2 ring-primary border-primary" : "border-input",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Search className="h-4 w-4 ml-3 text-muted-foreground shrink-0" />
        <Input
          ref={inputRef}
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
          placeholder={isOpen ? "Type to search..." : (displayValue || placeholder)}
          value={isOpen ? search : displayValue}
          onChange={(e) => {
            setSearch(e.target.value);
            setHighlightIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
        />
        <ChevronDown
          className={cn(
            "h-4 w-4 mr-3 text-muted-foreground shrink-0 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md"
        >
          {/* Matched options (top section) */}
          {matchedOptions.map((option, idx) => (
            <OptionItem
              key={`m-${option.value}`}
              option={option}
              isSelected={value === option.value}
              isHighlighted={highlightIndex === idx}
              onClick={() => handleSelect(option)}
            />
          ))}

          {/* "Show all" divider */}
          {hasMatched && unmatchedOptions.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              <span>{showAllLabel}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {/* Unmatched options (below divider) */}
          {unmatchedOptions.map((option, idx) => (
            <OptionItem
              key={`u-${option.value}`}
              option={option}
              isSelected={value === option.value}
              isHighlighted={highlightIndex === matchedOptions.length + idx}
              onClick={() => handleSelect(option)}
            />
          ))}

          {/* Empty state */}
          {matchedOptions.length === 0 && unmatchedOptions.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No options found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OptionItem({
  option,
  isSelected,
  isHighlighted,
  onClick,
}: {
  option: AutocompleteOption;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
}) {
  return (
    <div
      data-selectable="true"
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors min-h-[44px]",
        isHighlighted && "bg-accent/10",
        isSelected && "bg-primary/10 font-medium",
        !isHighlighted && !isSelected && "hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="truncate">{option.label}</div>
        {option.meta && (
          <div className="text-xs text-muted-foreground truncate">{option.meta}</div>
        )}
      </div>
      {option.category && (
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
          {option.category}
        </span>
      )}
      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
    </div>
  );
}
