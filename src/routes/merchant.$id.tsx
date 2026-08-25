import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RiskBadge, StageChip, VarianceBadge } from "@/components/risk-badges";
import { ScoreBreakdown } from "@/components/score-breakdown";
import { AccountHealthCard } from "@/components/account-health-card";
import { deleteRecord, getRecord, upsertRecord } from "@/lib/records-store";
import {
  compareStage2,
  decide,
  observedCategory,
  EMPTY_ACCOUNT_HEALTH,
  type AccountHealth,
  type ActualMetrics,
  type MerchantRecord,
} from "@/lib/risk-engine";

export const Route = createFileRoute("/merchant/$id")({
  head: () => ({
    meta: [
      { title: "Merchant Risk File | Risk Engine" },
      {
        name: "description",
        content:
          "Full audit trail for a merchant: legitimacy status, weighted score breakdown, monitoring outcome and final onboarding decision.",
      },
      { property: "og:title", content: "Merchant Risk File | Risk Engine" },
      {
        property: "og:description",
        content: "Score breakdown, monitoring variance and final decision for an onboarded merchant.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MerchantDetail,
});

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function MerchantDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<MerchantRecord | null | undefined>(undefined);
  const [metrics, setMetrics] = useState<ActualMetrics>({
    fraud_rate: 0,
    chargebacks: 0,
    refunds: 0,
    geo_behavior: "As expected",
  });
  const [health, setHealth] = useState<AccountHealth>(EMPTY_ACCOUNT_HEALTH);

  useEffect(() => {
    const r = getRecord(id);
    setRecord(r ?? null);
    if (r?.stage2) setMetrics(r.stage2.actual_metrics);
    setHealth(r?.account_health ?? EMPTY_ACCOUNT_HEALTH);
  }, [id]);

  const saveHealth = (next: AccountHealth) => {
    setHealth(next);
    setRecord((prev) => {
      if (!prev) return prev;
      const updated: MerchantRecord = { ...prev, account_health: next };
      upsertRecord(updated);
      return updated;
    });
  };


  if (record === undefined) {
    return <main className="mx-auto max-w-5xl px-6 py-16 text-muted-foreground">Loading…</main>;
  }

  if (record === null) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-muted-foreground">Record not found.</p>
        <Button asChild className="mt-4">
          <Link to="/">Back to portfolio</Link>
        </Button>
      </main>
    );
  }

  const r = record;
  const { merchant: m, assessment } = r;

  const saveStage2 = () => {
    if (!assessment) return;
    const actual = observedCategory(metrics);
    const variance = compareStage2(assessment.category, actual);
    const updated: MerchantRecord = {
      ...r,
      stage: 2,
      stage2: { actual_metrics: metrics, actual_outcome: actual, variance },
      final_decision: null,
    };
    upsertRecord(updated);
    setRecord(updated);
    toast.success("Monitoring outcome recorded");
  };

  const finalise = () => {
    if (!assessment || !r.stage2) return;
    const updated: MerchantRecord = {
      ...r,
      stage: 3,
      final_decision: decide(assessment.category, r.stage2.variance),
    };
    upsertRecord(updated);
    setRecord(updated);
    toast.success("Final decision issued");
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to portfolio
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            deleteRecord(r.id);
            navigate({ to: "/" });
          }}
        >
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{m.name}</h1>
          <p className="mt-1 text-muted-foreground">
            {m.industry} · {m.merchant_country} → {m.operating_country}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StageChip stage={r.stage} />
          {assessment && <RiskBadge category={assessment.category} />}
        </div>
      </header>

      {!assessment ? (
        <div className="panel mt-8 flex items-start gap-3 border-risk-red/45 bg-risk-red/10 p-6 text-risk-red">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">{r.legitimacy_status}</p>
            <p className="mt-1 text-sm opacity-90">
              Scoring was not executed. Failed checks:{" "}
              {Object.entries(r.legitimacy)
                .filter(([, v]) => !v)
                .map(([k]) => k.replace(/_/g, " "))
                .join(", ")}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="panel p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="label-caps">Total weighted score</p>
                  <p className="mt-1 font-mono text-5xl font-bold">
                    {assessment.total_score.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="label-caps">Monitoring window</p>
                  <p className="mt-1 text-xl font-semibold">{assessment.monitoring_days}</p>
                </div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(assessment.total_score / 5) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground">
                <span>1.0 low</span>
                <span>2.0</span>
                <span>3.0</span>
                <span>4.0</span>
                <span>5.0 red</span>
              </div>
            </section>

            <section className="panel p-6">
              <h2 className="text-lg font-semibold">Score breakdown</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Every adjustment applied by the engine, in order.
              </p>
              <ScoreBreakdown assessment={assessment} />
            </section>

            <AccountHealthCard value={health} onChange={saveHealth} />

            <section className="panel p-6">
              <h2 className="text-lg font-semibold">Stage 2 — monitoring validation</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Record observed behaviour during the monitoring window and compare it to the expected
                risk.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="label-caps">Fraud rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={metrics.fraud_rate}
                    onChange={(e) =>
                      setMetrics((p) => ({ ...p, fraud_rate: Math.max(0, Number(e.target.value) || 0) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="label-caps">Chargebacks (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={metrics.chargebacks}
                    onChange={(e) =>
                      setMetrics((p) => ({ ...p, chargebacks: Math.max(0, Number(e.target.value) || 0) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="label-caps">Refunds (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={metrics.refunds}
                    onChange={(e) =>
                      setMetrics((p) => ({ ...p, refunds: Math.max(0, Number(e.target.value) || 0) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="label-caps">Geo behaviour</Label>
                  <Select
                    value={metrics.geo_behavior}
                    onValueChange={(v) =>
                      setMetrics((p) => ({ ...p, geo_behavior: v as ActualMetrics["geo_behavior"] }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["As expected", "Minor drift", "Significant drift"].map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button className="mt-5" onClick={saveStage2}>
                {r.stage2 ? "Update monitoring outcome" : "Record monitoring outcome"}
              </Button>

              {r.stage2 && (
                <div className="mt-5 rounded-lg border border-border bg-surface-strong/60 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-muted-foreground">Expected</span>
                    <RiskBadge category={assessment.category} size="sm" />
                    <span className="text-sm text-muted-foreground">Observed</span>
                    <RiskBadge category={r.stage2.actual_outcome} size="sm" />
                    <VarianceBadge variance={r.stage2.variance} />
                  </div>
                </div>
              )}
            </section>

            <section className="panel p-6">
              <h2 className="text-lg font-semibold">Stage 3 — final decision</h2>
              {!r.stage2 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Complete Stage 2 monitoring before issuing a decision.
                </p>
              ) : (
                <>
                  <Button className="mt-4" onClick={finalise}>
                    {r.final_decision ? "Recalculate decision" : "Issue final decision"}
                  </Button>
                  {r.final_decision && (
                    <div
                      className={`mt-5 rounded-lg border p-5 ${
                        r.final_decision === "STANDARD TERMS"
                          ? "border-risk-low/40 bg-risk-low/10 text-risk-low"
                          : r.final_decision === "ADJUST TERMS or EXTEND"
                            ? "border-risk-orange/45 bg-risk-orange/10 text-risk-orange"
                            : "border-risk-red/45 bg-risk-red/10 text-risk-red"
                      }`}
                    >
                      <p className="label-caps">Decision</p>
                      <p className="mt-1 text-2xl font-bold">{r.final_decision}</p>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-8 lg:h-fit">
            <section className="panel p-6">
              <p className="label-caps">Legitimacy</p>
              <p className="mt-1 text-sm font-semibold text-risk-low">{r.legitimacy_status}</p>
              <div className="mt-4">
                <Row label="Email" value={m.merchant_email || "—"} />
                <Row label="Website" value={m.merchant_website || "—"} />
                <Row label="Email domain type" value={m.email_domain_type ?? "—"} />
                <Row label="IP fraud score" value={m.ip_fraud_score} />
                <Row
                  label="Stripe connected account"
                  value={m.stripe_account_exists === false ? "No" : "Yes"}
                />
                {m.stripe_account_exists && m.stripe_account_link && (
                  <Row label="Connected account link" value={m.stripe_account_link} />
                )}
                <Row label="Industry" value={m.industry} />
                <Row label="Product type" value={m.product_type} />
                <Row label="Delivery" value={m.delivery_type} />
                <Row label="Avg order value" value={m.avg_order_value} />
                <Row label="Business model" value={m.business_model} />
                <Row label="Processing history" value={m.processing_history} />
                <Row label="Maturity" value={m.business_maturity} />
                <Row label="Chargeback rate" value={`${m.chargeback_rate}%`} />
                <Row label="Fraud rate" value={`${m.fraud_rate}%`} />
                <Row label="Refund rate" value={`${m.refund_rate}%`} />
              </div>
            </section>

            <section className="panel p-6">
              <p className="label-caps">Tickets & notes</p>
              <div className="mt-3">
                {m.tickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tickets linked.</p>
                ) : (
                  m.tickets.map((t) => (
                    <Row key={t.id} label={t.reference || "Ticket"} value={t.summary || "—"} />
                  ))
                )}
              </div>
              <p className="mt-4 text-sm whitespace-pre-wrap text-muted-foreground">
                {m.internal_notes || "No internal notes."}
              </p>
            </section>

            <section className="panel p-6">
              <p className="label-caps">Customer distribution</p>
              <div className="mt-3">
                {m.customer_distribution.map((c, i) => (
                  <Row key={i} label={c.country} value={`${c.percentage}%`} />
                ))}
              </div>
            </section>

            <section className="panel p-6">
              <p className="label-caps">Dashboard output (JSON)</p>
              <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-background p-3 font-mono text-[11px] text-muted-foreground">
                {JSON.stringify(
                  {
                    merchant_name: m.name,
                    stage: r.stage,
                    legitimacy_status: r.legitimacy_status,
                    scores: Object.fromEntries(
                      Object.entries(assessment.scores).map(([k, v]) => [k, v.score]),
                    ),
                    total_score: assessment.total_score,
                    category: assessment.category,
                    monitoring_days: assessment.monitoring_days,
                    stage2: r.stage2
                      ? {
                          expected_risk: assessment.category,
                          actual_outcome: r.stage2.actual_outcome,
                          variance: r.stage2.variance,
                        }
                      : null,
                    final_decision: r.final_decision,
                  },
                  null,
                  2,
                )}
              </pre>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
