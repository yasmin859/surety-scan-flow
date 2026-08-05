import type { Category, Variance } from "@/lib/risk-engine";
import { cn } from "@/lib/utils";

const CATEGORY_CLASS: Record<Category, string> = {
  LOW: "bg-risk-low/15 text-risk-low border-risk-low/40",
  MEDIUM: "bg-risk-medium/15 text-risk-medium border-risk-medium/40",
  ORANGE: "bg-risk-orange/15 text-risk-orange border-risk-orange/40",
  RED: "bg-risk-red/18 text-risk-red border-risk-red/45",
};

export function RiskBadge({
  category,
  className,
  size = "md",
}: {
  category: Category;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-[0.12em] uppercase",
        size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        CATEGORY_CLASS[category],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {category}
    </span>
  );
}

const VARIANCE_CLASS: Record<Variance, string> = {
  ACCURATE: "bg-risk-low/15 text-risk-low border-risk-low/40",
  "FALSE POSITIVE": "bg-primary/15 text-primary border-primary/40",
  "UNDER-ESTIMATED RISK": "bg-risk-red/18 text-risk-red border-risk-red/45",
};

export function VarianceBadge({ variance }: { variance: Variance }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.1em] uppercase",
        VARIANCE_CLASS[variance],
      )}
    >
      {variance}
    </span>
  );
}

export function StageChip({ stage }: { stage: 1 | 2 | 3 }) {
  const labels = { 1: "Stage 1 · Assessment", 2: "Stage 2 · Monitoring", 3: "Stage 3 · Decision" };
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-surface-strong px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
      {labels[stage]}
    </span>
  );
}
