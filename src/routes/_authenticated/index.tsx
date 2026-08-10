import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, LogOut, Plus, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RiskBadge, StageChip } from "@/components/risk-badges";
import { supabase } from "@/integrations/supabase/client";
import { loadRecords } from "@/lib/records-store";
import type { Category, MerchantRecord } from "@/lib/risk-engine";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Merchant Risk Engine | Onboarding Portfolio" },
      {
        name: "description",
        content:
          "Weighted merchant risk scoring, legitimacy gating, monitoring windows and a 3-stage onboarding lifecycle in one auditable console.",
      },
      { property: "og:title", content: "Merchant Risk Engine | Onboarding Portfolio" },
      {
        property: "og:description",
        content:
          "Score new merchants, assign monitoring windows and track Stage 1-3 onboarding decisions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="panel p-5">
      <p className="label-caps">{label}</p>
      <p className={`mt-2 font-mono text-3xl font-bold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}

function Dashboard() {
  const [records, setRecords] = useState<MerchantRecord[] | null>(null);

  useEffect(() => {
    setRecords(loadRecords());
  }, []);

  const list = records ?? [];
  const counts = list.reduce<Record<Category, number>>(
    (acc, r) => {
      const cat: Category = r.assessment ? r.assessment.category : "REJECTED";
      acc[cat] += 1;
      return acc;
    },
    { LOW: 0, MEDIUM: 0, HIGH: 0, REJECTED: 0 },
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps flex items-center gap-2">
            <Activity className="size-3.5 text-primary" /> Risk assessment engine
          </p>
          <h1 className="mt-2 text-4xl font-bold">Merchant onboarding portfolio</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Legitimacy gating, weighted risk scoring, monitoring windows and a three-stage lifecycle —
            every score fully explainable and auditable.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="lg">
            <Link to="/new">
              <Plus className="size-4" /> New assessment
            </Link>
          </Button>
          <Button variant="ghost" size="lg" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>

      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Merchants assessed" value={list.length} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        {(["LOW", "MEDIUM", "HIGH", "REJECTED"] as Category[]).map((c) => (
          <div key={c} className="panel flex items-center justify-between p-4">
            <RiskBadge category={c} size="sm" />
            <span className="font-mono text-xl font-semibold">{counts[c]}</span>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Records</h2>

        {records === null ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <div className="panel mt-4 p-10 text-center">
            <p className="text-muted-foreground">No merchants assessed yet.</p>
            <Button asChild className="mt-4">
              <Link to="/new">Run the first assessment</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {list.map((r) => (
              <li key={r.id}>
                <Link
                  to="/merchant/$id"
                  params={{ id: r.id }}
                  className="panel flex flex-wrap items-center gap-4 p-5 transition-colors hover:border-primary/50"
                >
                  <div className="min-w-52 flex-1">
                    <p className="font-semibold">{r.merchant.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.merchant.industry} · {r.merchant.merchant_country}
                    </p>
                  </div>

                  <StageChip stage={r.stage} />

                  {r.assessment ? (
                    <>
                      <span className="font-mono text-lg font-semibold">
                        {r.assessment.total_score.toFixed(2)}
                      </span>
                      <RiskBadge category={r.assessment.category} />
                      <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                        {r.assessment.monitoring_days}
                      </span>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border border-risk-red/45 bg-risk-red/10 px-3 py-1 text-xs font-semibold text-risk-red">
                      <ShieldAlert className="size-3.5" /> REJECTED
                    </span>
                  )}

                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
