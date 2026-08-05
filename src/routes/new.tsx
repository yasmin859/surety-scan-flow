import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RiskBadge } from "@/components/risk-badges";
import { ScoreBreakdown } from "@/components/score-breakdown";
import {
  COUNTRIES,
  INDUSTRIES,
  checkLegitimacy,
  runAssessment,
  type BusinessMaturity,
  type BusinessModel,
  type CustomerCountry,
  type DeliveryType,
  type Fulfilment,
  type Legitimacy,
  type Merchant,
  type MerchantRecord,
  type PaymentFlow,
  type ProcessingHistory,
  type ProductType,
  type Refundability,
  type SellerControls,
} from "@/lib/risk-engine";
import { upsertRecord } from "@/lib/records-store";

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "New Merchant Assessment | Risk Engine" },
      {
        name: "description",
        content:
          "Run a Stage 1 merchant risk assessment: legitimacy gate, weighted scoring and monitoring duration.",
      },
      { property: "og:title", content: "New Merchant Assessment | Risk Engine" },
      {
        property: "og:description",
        content: "Legitimacy gate, weighted risk scoring and monitoring assignment for new merchants.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewAssessment,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="label-caps">{label}</Label>
      {children}
    </div>
  );
}

function Picker<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly string[];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SectionCard({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-6">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="font-mono text-xs text-primary">{step}</span>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const emptyMerchant: Merchant = {
  name: "",
  merchant_country: "United Kingdom",
  operating_country: "United Kingdom",
  customer_distribution: [{ country: "United Kingdom", percentage: 100 }],
  industry: "Retail / eCommerce",
  product_type: "Physical",
  refundability: "Easy",
  delivery_type: "Delayed",
  avg_order_value: 60,
  business_model: "Direct",
  seller_controls: "Strong",
  payment_flow: "Merchant controls funds",
  fulfilment: "Merchant fulfils",
  processing_history: "No history",
  chargeback_rate: 0,
  fraud_rate: 0,
  refund_rate: 0,
  business_maturity: "1-3 years",
};

function NewAssessment() {
  const navigate = useNavigate();
  const [legit, setLegit] = useState<Legitimacy>({
    registered_business: true,
    website_live: true,
    ownership_verified: true,
    activity_matches_description: true,
  });
  const [m, setM] = useState<Merchant>(emptyMerchant);

  const set = <K extends keyof Merchant>(k: K, v: Merchant[K]) => setM((p) => ({ ...p, [k]: v }));

  const gate = useMemo(() => checkLegitimacy(legit), [legit]);
  const preview = useMemo(() => (gate.passed ? runAssessment(m) : null), [gate.passed, m]);

  const distTotal = m.customer_distribution.reduce((s, c) => s + (Number(c.percentage) || 0), 0);

  const updateDist = (i: number, patch: Partial<CustomerCountry>) =>
    setM((p) => ({
      ...p,
      customer_distribution: p.customer_distribution.map((c, idx) =>
        idx === i ? { ...c, ...patch } : c,
      ),
    }));

  const submit = () => {
    if (!m.name.trim()) {
      toast.error("Merchant name is required");
      return;
    }
    const assessment = gate.passed ? runAssessment(m) : null;
    const record: MerchantRecord = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      stage: 1,
      merchant: { ...m, name: m.name.trim() },
      legitimacy: legit,
      legitimacy_status: gate.status,
      assessment,
      stage2: null,
      final_decision: gate.passed ? null : "REJECTED - LEGITIMACY FAILURE",
    };
    upsertRecord(record);
    toast.success(gate.passed ? "Assessment recorded" : "Merchant rejected at legitimacy gate");
    navigate({ to: "/merchant/$id", params: { id: record.id } });
  };

  const legitFields: { key: keyof Legitimacy; label: string }[] = [
    { key: "registered_business", label: "Registered business" },
    { key: "website_live", label: "Website live" },
    { key: "ownership_verified", label: "Ownership verified" },
    { key: "activity_matches_description", label: "Activity matches description" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to portfolio
      </Link>

      <h1 className="mt-4 text-3xl font-bold">New merchant assessment</h1>
      <p className="mt-1 text-muted-foreground">
        Stage 1 — legitimacy gate, weighted scoring, category and monitoring assignment.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <SectionCard
            step="STEP 1"
            title="Legitimacy check"
            subtitle="Hard gate — any failure rejects the merchant and stops scoring."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {legitFields.map((f) => (
                <div
                  key={f.key}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-strong/60 px-4 py-3"
                >
                  <span className="text-sm">{f.label}</span>
                  <Switch
                    checked={legit[f.key]}
                    onCheckedChange={(v) => setLegit((p) => ({ ...p, [f.key]: v }))}
                  />
                </div>
              ))}
            </div>

            <div
              className={`mt-4 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
                gate.passed
                  ? "border-risk-low/40 bg-risk-low/10 text-risk-low"
                  : "border-risk-red/45 bg-risk-red/10 text-risk-red"
              }`}
            >
              {gate.passed ? (
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              ) : (
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              )}
              <div>
                <p className="font-semibold">{gate.status}</p>
                {!gate.passed && (
                  <p className="mt-1 text-xs opacity-90">Failed: {gate.failures.join(", ")}</p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard step="STEP 2" title="Merchant profile">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Merchant name">
                <Input
                  value={m.name}
                  onChange={(e) => set("name", e.target.value.slice(0, 120))}
                  placeholder="Acme Commerce Ltd"
                />
              </Field>
              <Field label="Industry">
                <Picker value={m.industry} onChange={(v) => set("industry", v)} options={INDUSTRIES} />
              </Field>
              <Field label="Merchant country">
                <Picker
                  value={m.merchant_country}
                  onChange={(v) => set("merchant_country", v)}
                  options={COUNTRIES}
                />
              </Field>
              <Field label="Operating country">
                <Picker
                  value={m.operating_country}
                  onChange={(v) => set("operating_country", v)}
                  options={COUNTRIES}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            step="STEP 3"
            title="Customer exposure"
            subtitle="Top 5 countries by volume are used for the weighted exposure score."
          >
            <div className="space-y-3">
              {m.customer_distribution.map((c, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex-1">
                    <Picker
                      value={c.country}
                      onChange={(v) => updateDist(i, { country: v })}
                      options={COUNTRIES}
                    />
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="w-28"
                    value={c.percentage}
                    onChange={(e) =>
                      updateDist(i, { percentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setM((p) => ({
                        ...p,
                        customer_distribution: p.customer_distribution.filter((_, idx) => idx !== i),
                      }))
                    }
                    disabled={m.customer_distribution.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setM((p) => ({
                    ...p,
                    customer_distribution: [
                      ...p.customer_distribution,
                      { country: "Germany", percentage: 0 },
                    ],
                  }))
                }
              >
                Add country
              </Button>
              <span
                className={`font-mono text-xs ${distTotal === 100 ? "text-muted-foreground" : "text-risk-medium"}`}
              >
                total {distTotal}%
              </span>
            </div>
          </SectionCard>

          <SectionCard step="STEP 4" title="Product & business model">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product type">
                <Picker<ProductType>
                  value={m.product_type}
                  onChange={(v) => set("product_type", v)}
                  options={["Physical", "Digital", "Subscription"]}
                />
              </Field>
              <Field label="Refundability">
                <Picker<Refundability>
                  value={m.refundability}
                  onChange={(v) => set("refundability", v)}
                  options={["Easy", "Moderate", "Difficult"]}
                />
              </Field>
              <Field label="Delivery type">
                <Picker<DeliveryType>
                  value={m.delivery_type}
                  onChange={(v) => set("delivery_type", v)}
                  options={["Instant", "Delayed"]}
                />
              </Field>
              <Field label="Average order value">
                <Input
                  type="number"
                  min={0}
                  value={m.avg_order_value}
                  onChange={(e) => set("avg_order_value", Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>
              <Field label="Business model">
                <Picker<BusinessModel>
                  value={m.business_model}
                  onChange={(v) => set("business_model", v)}
                  options={["Direct", "Marketplace", "Aggregator", "Dropshipping"]}
                />
              </Field>
              <Field label="Seller controls">
                <Picker<SellerControls>
                  value={m.seller_controls}
                  onChange={(v) => set("seller_controls", v)}
                  options={["Strong", "Moderate", "Weak"]}
                />
              </Field>
              <Field label="Payment flow">
                <Picker<PaymentFlow>
                  value={m.payment_flow}
                  onChange={(v) => set("payment_flow", v)}
                  options={["Merchant controls funds", "Third-party controls funds"]}
                />
              </Field>
              <Field label="Fulfilment">
                <Picker<Fulfilment>
                  value={m.fulfilment}
                  onChange={(v) => set("fulfilment", v)}
                  options={["Merchant fulfils", "Shared responsibility", "Third-party fulfils"]}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard step="STEP 5" title="History & maturity">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Processing history">
                <Picker<ProcessingHistory>
                  value={m.processing_history}
                  onChange={(v) => set("processing_history", v)}
                  options={["No history", "<6 months", "6-12 months", "1-3 years", "3+ years"]}
                />
              </Field>
              <Field label="Business maturity">
                <Picker<BusinessMaturity>
                  value={m.business_maturity}
                  onChange={(v) => set("business_maturity", v)}
                  options={["MVP", "<1 year", "1-3 years", "3+ years"]}
                />
              </Field>
              <Field label="Chargeback rate (%)">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={m.chargeback_rate}
                  onChange={(e) => set("chargeback_rate", Math.max(0, Number(e.target.value) || 0))}
                  disabled={m.processing_history === "No history"}
                />
              </Field>
              <Field label="Fraud rate (%)">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={m.fraud_rate}
                  onChange={(e) => set("fraud_rate", Math.max(0, Number(e.target.value) || 0))}
                  disabled={m.processing_history === "No history"}
                />
              </Field>
              <Field label="Refund rate (%)">
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={m.refund_rate}
                  onChange={(e) => set("refund_rate", Math.max(0, Number(e.target.value) || 0))}
                  disabled={m.processing_history === "No history"}
                />
              </Field>
            </div>
          </SectionCard>
        </div>

        <aside className="lg:sticky lg:top-8 lg:h-fit">
          <div className="panel p-6">
            <p className="label-caps">Live preview</p>
            {preview ? (
              <>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="font-mono text-4xl font-bold">{preview.total_score.toFixed(2)}</span>
                  <RiskBadge category={preview.category} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Monitoring: <span className="text-foreground">{preview.monitoring_days}</span>
                </p>
                <div className="mt-5 max-h-[46vh] overflow-y-auto pr-1">
                  <ScoreBreakdown assessment={preview} />
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-risk-red">
                Legitimacy gate failed — scoring is blocked. Fix the failing checks or record the rejection.
              </p>
            )}
            <Button className="mt-6 w-full" onClick={submit}>
              {gate.passed ? "Save assessment" : "Record rejection"}
            </Button>
          </div>
        </aside>
      </div>
    </main>
  );
}
