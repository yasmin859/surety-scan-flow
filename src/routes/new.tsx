import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert, ShieldCheck, Ticket, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  EMAIL_DOMAIN_TYPES,
  INDUSTRY_CATALOG,
  STRIPE_RESTRICTED_URL,
  checkIndustry,
  checkLegitimacy,
  industryDef,
  runAssessment,
  type BusinessMaturity,
  type BusinessModel,
  type CustomerCountry,
  type DeliveryType,
  type Legitimacy,
  type Merchant,
  type MerchantRecord,
  type MerchantTicket,
  type ProcessingHistory,
  type ProductType,
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

function SubBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-strong/60 p-4">
      <p className="label-caps mb-3">{title}</p>
      {children}
    </div>
  );
}

const emptyMerchant: Merchant = {
  name: "",
  merchant_email: "",
  merchant_website: "",
  merchant_country: "United Kingdom",
  operating_country: "United Kingdom",

  industry: "Retail / eCommerce",
  email_domain_type: "Verified corporate domain",
  ip_fraud_score: 0,
  stripe_account_exists: true,
  stripe_account_link: "",
  product_type: "Physical",
  delivery_type: "Delayed",
  avg_order_value: 60,
  business_model: "Ecommerce",
  processing_history: "No history",
  chargeback_rate: 0,
  fraud_rate: 0,
  refund_rate: 0,
  business_maturity: "1-3 years",
  tickets: [],
  internal_notes: "",
};

const INDUSTRY_OPTIONS = INDUSTRY_CATALOG.map((i) =>
  i.status === "allowed"
    ? i.name
    : `${i.name} — ${i.status === "prohibited" ? "Prohibited" : "Restricted"}`,
);
const optionToIndustry = (v: string) => v.split(" — ")[0] ?? v;
const industryToOption = (name: string) => {
  const def = industryDef(name);
  return def.status === "allowed"
    ? def.name
    : `${def.name} — ${def.status === "prohibited" ? "Prohibited" : "Restricted"}`;
};

function NewAssessment() {
  const navigate = useNavigate();
  const [legit, setLegit] = useState<Legitimacy>({
    registered_business: true,
    website_live: true,
  });
  const [m, setM] = useState<Merchant>(emptyMerchant);

  const set = <K extends keyof Merchant>(k: K, v: Merchant[K]) => setM((p) => ({ ...p, [k]: v }));

  const gate = useMemo(() => checkLegitimacy(legit), [legit]);
  const industryGate = useMemo(() => checkIndustry(m.industry), [m.industry]);
  const preview = useMemo(() => (gate.passed ? runAssessment(m) : null), [gate.passed, m]);

  const updateTicket = (id: string, patch: Partial<MerchantTicket>) =>

    setM((p) => ({
      ...p,
      tickets: p.tickets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));

  const submit = () => {
    if (!m.name.trim()) {
      toast.error("Merchant name is required");
      return;
    }
    const assessment = gate.passed ? runAssessment(m) : null;
    const rejected = !gate.passed || assessment?.category === "REJECTED";
    const record: MerchantRecord = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      stage: 1,
      merchant: { ...m, name: m.name.trim() },
      legitimacy: legit,
      legitimacy_status: gate.status,
      assessment,
      stage2: null,
      final_decision: !gate.passed
        ? "REJECTED - LEGITIMACY FAILURE"
        : assessment?.category === "REJECTED"
          ? "REJECTED - NOT ONBOARDED"
          : null,
    };
    upsertRecord(record);
    toast.success(rejected ? "Merchant recorded as Rejected" : "Assessment recorded");
    navigate({ to: "/merchant/$id", params: { id: record.id } });
  };

  const legitFields: { key: keyof Legitimacy; label: string }[] = [
    { key: "registered_business", label: "Registered business" },
    { key: "website_live", label: "Website live" },
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
        Stage 1 — weighted scoring, risk level and monitoring assignment.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <SectionCard step="STEP 1" title="Merchant profile">

            <div className="space-y-4">
              <SubBox title="Merchant details">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Merchant name">
                    <Input
                      value={m.name}
                      onChange={(e) => set("name", e.target.value.slice(0, 120))}
                      placeholder="Acme Commerce Ltd"
                    />
                  </Field>
                  <Field label="Industry">
                    <Picker
                      value={industryToOption(m.industry)}
                      onChange={(v) => set("industry", optionToIndustry(v))}
                      options={INDUSTRY_OPTIONS}
                    />
                  </Field>
                  <Field label="Merchant email">
                    <Input
                      type="email"
                      value={m.merchant_email}
                      onChange={(e) => set("merchant_email", e.target.value.slice(0, 255))}
                      placeholder="risk@acme.com"
                    />
                  </Field>
                  <Field label="Merchant website">
                    <Input
                      value={m.merchant_website}
                      onChange={(e) => set("merchant_website", e.target.value.slice(0, 255))}
                      placeholder="https://acme.com"
                    />
                  </Field>
                  <Field label="UBO country">
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

                {industryGate.rejected && (
                  <div className="mt-4 flex items-start gap-3 rounded-lg border border-risk-red/45 bg-risk-red/10 px-4 py-3 text-sm text-risk-red">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Status set to Rejected</p>
                      <p className="mt-1 text-xs opacity-90">
                        {industryGate.reason}{" "}
                        <a
                          className="underline"
                          href={STRIPE_RESTRICTED_URL}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Source of truth
                        </a>
                      </p>
                    </div>
                  </div>
                )}
              </SubBox>

              <SubBox title="Business verification & Stripe account">
                <div className="grid gap-3 sm:grid-cols-2">
                  {legitFields.map((f) => (
                    <div
                      key={f.key}
                      className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-4 py-3"
                    >
                      <span className="text-sm">{f.label}</span>
                      <Switch
                        checked={legit[f.key]}
                        onCheckedChange={(v) => setLegit((p) => ({ ...p, [f.key]: v }))}
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-4 py-3">
                    <span className="text-sm">Stripe connected account</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {m.stripe_account_exists ? "Yes" : "No"}
                      </span>
                      <Switch
                        checked={m.stripe_account_exists}
                        onCheckedChange={(v) => {
                          set("stripe_account_exists", v);
                          if (!v) set("stripe_account_link", "");
                        }}
                      />
                    </div>
                  </div>
                </div>

                {m.stripe_account_exists && (
                  <div className="mt-4">
                    <Field label="Connected account link">
                      <Input
                        value={m.stripe_account_link}
                        onChange={(e) => set("stripe_account_link", e.target.value.slice(0, 255))}
                        placeholder="https://dashboard.stripe.com/connect/accounts/acct_..."
                      />
                    </Field>
                  </div>
                )}

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
                    <p className="mt-1 text-xs opacity-80">
                      Stripe connected account is tracked for operations only — it does not affect the
                      risk score.
                    </p>
                  </div>
                </div>
              </SubBox>


              <SubBox title="IP & email quality check">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email domain type">
                    <Picker
                      value={m.email_domain_type}
                      onChange={(v) => set("email_domain_type", v as typeof m.email_domain_type)}
                      options={EMAIL_DOMAIN_TYPES}
                    />
                  </Field>
                  <Field label="IP fraud score (0-100)">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={m.ip_fraud_score}
                      onChange={(e) =>
                        set("ip_fraud_score", Math.max(0, Math.min(100, Number(e.target.value) || 0)))
                      }
                    />
                  </Field>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Score is the higher of the IP band and the email domain sub-score. Custom domains that
                  don't match the merchant website add +1; an IP score above 80 adds +0.5 (max 5).
                </p>
              </SubBox>

            </div>
          </SectionCard>

          <SectionCard step="STEP 2" title="Product & business model">

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product type">
                <Picker<ProductType>
                  value={m.product_type}
                  onChange={(v) => set("product_type", v)}
                  options={["Physical", "Digital", "Subscription"]}
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
                  options={["Ecommerce", "Marketplace", "Wayflyer Referral", "StoreHero Referral"]}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard step="STEP 4" title="History & maturity">
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

          <SectionCard
            step="STEP 5"
            title="Tickets & internal notes"
            subtitle="Internal context only — not part of the weighted score."
          >
            <div className="space-y-3">
              {m.tickets.length === 0 && (
                <p className="text-sm text-muted-foreground">No tickets linked yet.</p>
              )}
              {m.tickets.map((t) => (
                <div key={t.id} className="flex flex-wrap gap-3">
                  <Input
                    className="w-40"
                    placeholder="Ticket ref"
                    value={t.reference}
                    onChange={(e) => updateTicket(t.id, { reference: e.target.value.slice(0, 60) })}
                  />
                  <Input
                    className="min-w-52 flex-1"
                    placeholder="Ticket context"
                    value={t.summary}
                    onChange={(e) => updateTicket(t.id, { summary: e.target.value.slice(0, 300) })}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setM((p) => ({ ...p, tickets: p.tickets.filter((x) => x.id !== t.id) }))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() =>
                setM((p) => ({
                  ...p,
                  tickets: [...p.tickets, { id: crypto.randomUUID(), reference: "", summary: "" }],
                }))
              }
            >
              <Ticket className="size-4" /> Link ticket
            </Button>

            <div className="mt-5 space-y-2">
              <Label className="label-caps">Additional comments</Label>
              <Textarea
                rows={5}
                maxLength={2000}
                placeholder="Ticket context, risk considerations, relevant background…"
                value={m.internal_notes}
                onChange={(e) => set("internal_notes", e.target.value.slice(0, 2000))}
              />
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
                {preview.rejection_reason && (
                  <p className="mt-2 text-xs text-risk-red">{preview.rejection_reason}</p>
                )}
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
              {gate.passed && preview?.category !== "REJECTED" ? "Save assessment" : "Record rejection"}
            </Button>
          </div>
        </aside>
      </div>
    </main>
  );
}
