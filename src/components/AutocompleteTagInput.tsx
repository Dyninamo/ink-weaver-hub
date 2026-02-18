import { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Category = "method" | "fly" | "spot" | "line" | "retrieve" | "depth";

interface AutocompleteTagInputProps {
  category: Category;
  venue?: string;
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  singleSelect?: boolean;
  className?: string;
}

const AutocompleteTagInput = ({
  category,
  venue,
  value,
  onChange,
  placeholder = "Type to add...",
  maxItems,
  singleSelect = false,
  className,
}: AutocompleteTagInputProps) => {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch suggestions from reference_data
  const fetchSuggestions = useCallback(
    async (search: string) => {
      let query = supabase
        .from("reference_data")
        .select("value")
        .eq("category", category)
        .order("usage_count", { ascending: false })
        .limit(10);

      if (search) {
        query = query.ilike("value", `%${search}%`);
      }

      if (venue && category === "spot") {
        query = query.or(`venue.eq.${venue},venue.is.null`);
      }

      const { data } = await query;
      if (data) {
        setSuggestions(
          data
            .map((r: { value: string }) => r.value)
            .filter((v: string) => !value.includes(v))
        );
      }
    },
    [category, venue, value]
  );

  // Fetch on focus / input change
  useEffect(() => {
    if (showSuggestions) {
      fetchSuggestions(input);
    }
  }, [input, showSuggestions, fetchSuggestions]);

  const addValue = async (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) return;
    if (maxItems && value.length >= maxItems) return;

    if (singleSelect) {
      onChange([trimmed]);
    } else {
      onChange([...value, trimmed]);
    }
    setInput("");
    setHighlightIndex(-1);

    const isExisting = suggestions.includes(trimmed);

    if (isExisting) {
      // Increment usage_count for existing suggestions so popular choices rise to the top
      supabase
        .from("reference_data")
        .select("id, usage_count")
        .eq("category", category)
        .eq("value", trimmed)
        .then(({ data: rows }) => {
          if (rows && rows.length > 0) {
            supabase
              .from("reference_data")
              .update({ usage_count: (rows[0].usage_count ?? 0) + 1 })
              .eq("id", rows[0].id)
              .then(() => {});
          }
        });
    } else {
      // Upsert new custom value with usage_count=1, or bump if conflict
      supabase
        .from("reference_data")
        .upsert(
          { category, value: trimmed, venue: category === "spot" ? venue || null : null, usage_count: 1 } as any,
          { onConflict: "category,value,venue" }
        )
        .then(() => {});
    }

    if (singleSelect) {
      setShowSuggestions(false);
    } else {
      inputRef.current?.focus();
    }
  };

  const removeValue = (val: string) => {
    onChange(value.filter((v) => v !== val));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && suggestions[highlightIndex]) {
        addValue(suggestions[highlightIndex]);
      } else if (input.trim()) {
        addValue(input);
      }
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      removeValue(value[value.length - 1]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // Single-select mode renders like a normal input
  if (singleSelect) {
    const currentValue = value[0] || "";
    return (
      <div ref={wrapperRef} className={cn("relative", className)}>
        <Input
          value={input || currentValue}
          onChange={(e) => {
            setInput(e.target.value);
            if (currentValue) onChange([]);
            setShowSuggestions(true);
            setHighlightIndex(-1);
          }}
          onFocus={() => {
            setInput(currentValue);
            if (currentValue) onChange([]);
            setShowSuggestions(true);
          }}
          onBlur={() => {
            // If user typed something but didn't select, keep it
            setTimeout(() => {
              if (input.trim() && value.length === 0) {
                addValue(input);
              }
            }, 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-10"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
            {suggestions.map((item, idx) => (
              <button
                key={item}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors",
                  idx === highlightIndex && "bg-muted"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addValue(item);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Multi-select mode with tags
  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div
        className="flex flex-wrap gap-1.5 p-2 border border-input rounded-md bg-background min-h-[42px] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1.5 rounded touch-manipulation"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeValue(tag);
              }}
              className="hover:text-destructive ml-0.5 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {(!maxItems || value.length < maxItems) && (
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(true);
              setHighlightIndex(-1);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[100px] bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground py-1"
          />
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
          {suggestions.map((item, idx) => (
            <button
              key={item}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors",
                idx === highlightIndex && "bg-muted"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                addValue(item);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutocompleteTagInput;
