import type { Assessment } from "@/lib/risk-engine";
import { WEIGHTS } from "@/lib/risk-engine";

const ROWS: { key: keyof Assessment["scores"]; label: string; weight: number }[] = [
  { key: "merchant_country", label: "Merchant country", weight: WEIGHTS.merchant_country },
  { key: "customer_exposure", label: "Customer exposure", weight: WEIGHTS.customer_exposure },
  { key: "industry_product", label: "Industry / product", weight: WEIGHTS.industry_product },
  { key: "business_model", label: "Business model", weight: WEIGHTS.business_model },
  { key: "historical", label: "Historical performance", weight: WEIGHTS.historical },
  { key: "business_maturity", label: "Business maturity", weight: WEIGHTS.business_maturity },
];

export function ScoreBreakdown({ assessment }: { assessment: Assessment }) {
  return (
    <div className="space-y-3">
      {ROWS.map(({ key, label, weight }) => {
        const c = assessment.scores[key];
        const contribution = Math.round(c.score * weight * 100) / 100;
        return (
          <div key={key} className="rounded-lg border border-border bg-surface-strong/60 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h4 className="text-sm font-semibold">{label}</h4>
                <span className="font-mono text-[11px] text-muted-foreground">
                  weight {Math.round(weight * 100)}%
                </span>
              </div>
              <div className="font-mono text-sm">
                <span className="text-foreground">{c.score.toFixed(2)}</span>
                <span className="text-muted-foreground"> → +{contribution.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(c.score / 5) * 100}%` }}
              />
            </div>

            <ul className="mt-3 space-y-1">
              {c.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-4 font-mono text-xs text-muted-foreground">
                  <span>{l.label}</span>
                  <span className={l.value < 0 ? "text-risk-low" : ""}>
                    {i === 0 && l.value > 0 && !l.label.startsWith("Base") && !l.label.startsWith("Baseline")
                      ? l.value.toFixed(2)
                      : `${l.value > 0 && i > 0 ? "+" : ""}${l.value.toFixed(2)}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
