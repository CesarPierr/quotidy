import { useId } from "react";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface QuotidyLogoProps {
  className?: string;
  withText?: boolean;
  size?: number;
}

const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-display), Fraunces, Georgia, serif",
};

export function QuotidyLogo({
  className,
  withText = true,
  size = 40,
}: QuotidyLogoProps) {
  const gradId = useId();
  const filterId = useId();

  const wordmark = (px: number) => (
    <span
      style={{ ...SERIF, fontSize: px, lineHeight: 1 }}
      className="font-medium tracking-tight text-ink-950"
    >
      {APP_NAME}
    </span>
  );

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 drop-shadow-sm"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffce8a" />
            <stop offset="100%" stopColor="#d8643d" />
          </linearGradient>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <rect width="100" height="100" rx="28" fill="var(--sand-100)" />
        
        {/* L'Arche (Foyer/Protection) */}
        <path
          d="M 25 75 V 45 A 25 25 0 0 1 75 45 V 75"
          stroke="var(--ink-950)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Le Soleil Levant (Demi-cercle) */}
        <path 
          d="M 34 75 A 16 16 0 0 1 66 75 Z"
          fill={`url(#${gradId})`} 
          filter={`url(#${filterId})`}
        />

        {/* Ligne d'horizon */}
        <line
          x1="20"
          y1="75"
          x2="80"
          y2="75"
          stroke="var(--ink-950)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {withText && wordmark(Math.round(size * 0.62))}
    </div>
  );
}
