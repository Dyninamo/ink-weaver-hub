import { cn } from "@/lib/utils";

interface FrequencyBarProps {
  label: string;
  value: number;
  maxValue: number;
  className?: string;
}

export function FrequencyBar({ label, value, maxValue, className }: FrequencyBarProps) {
  const percentage = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  const barWidth = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="text-sm font-medium text-foreground w-28 truncate shrink-0">
        {label}
      </span>
      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-10 text-right shrink-0">
        {percentage}%
      </span>
    </div>
  );
}
