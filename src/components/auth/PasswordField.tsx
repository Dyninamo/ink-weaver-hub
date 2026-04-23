import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PasswordFieldProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  className?: string;
}

export default function PasswordField({
  id = "password",
  value,
  onChange,
  placeholder = "Min 8 characters",
  autoComplete = "current-password",
  required = true,
  minLength = 8,
  className,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className="pr-14"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground px-1.5 py-0.5"
        tabIndex={-1}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}

/** Lightweight password strength scorer (0-4). No external deps. */
export function scorePassword(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  // Penalise overly common patterns
  if (/^(password|123456|qwerty|letmein)/i.test(pw)) score = Math.min(score, 1);
  return Math.min(score, 4);
}

interface StrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: StrengthMeterProps) {
  const score = scorePassword(password);
  const labels = ["Too short", "Weak", "OK", "Good", "Strong"];
  const colors = [
    "bg-muted",
    "bg-destructive",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-emerald-600",
  ];
  if (!password) return null;

  return (
    <div className="space-y-1.5 mt-1.5">
      <div className="grid grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((seg) => (
          <div
            key={seg}
            className={cn(
              "h-1 rounded-full transition-colors",
              seg <= score ? colors[score] : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {labels[score]}
      </p>
    </div>
  );
}
