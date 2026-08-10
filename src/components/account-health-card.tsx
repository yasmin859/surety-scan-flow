import { HeartPulse } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCOUNT_IMPACTS,
  CONTACT_STATUSES,
  VERIFICATION_STATUSES,
  type AccountHealth,
} from "@/lib/risk-engine";

interface Props {
  value: AccountHealth;
  onChange: (next: AccountHealth) => void;
}

/**
 * Operational account-health tracker.
 * Purely informational — never feeds the weighted risk score.
 */
export function AccountHealthCard({ value, onChange }: Props) {
  const set = <K extends keyof AccountHealth>(key: K, v: AccountHealth[K]) =>
    onChange({ ...value, [key]: v });

  const needsAttention = value.verification_status !== "Complete";

  return (
    <section
      className={`panel p-6 ${
        needsAttention ? "border-risk-orange/50 bg-risk-orange/5" : "border-risk-low/40 bg-risk-low/5"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HeartPulse className={`size-5 ${needsAttention ? "text-risk-orange" : "text-risk-low"}`} />
          <h2 className="text-lg font-semibold">Account health</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            needsAttention
              ? "bg-risk-orange/15 text-risk-orange"
              : "bg-risk-low/15 text-risk-low"
          }`}
        >
          {needsAttention ? "Operational alert" : "Healthy"}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Operational status only — this section does not affect the risk score or any weighted factor.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="label-caps">Stripe account verification status</Label>
          <Select
            value={value.verification_status}
            onValueChange={(v) =>
              set("verification_status", v as AccountHealth["verification_status"])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VERIFICATION_STATUSES.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {needsAttention && (
          <div className="space-y-2">
            <Label className="label-caps">Impact</Label>
            <Select value={value.impact} onValueChange={(v) => set("impact", v as AccountHealth["impact"])}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select impact" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_IMPACTS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2 sm:col-span-2">
          <Label className="label-caps">Missing items</Label>
          <Textarea
            rows={2}
            placeholder="e.g. Proof of address, director ID"
            value={value.missing_items}
            onChange={(e) => set("missing_items", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="label-caps">Follow-up ticket ID / link</Label>
          <Input
            placeholder="Zendesk ticket ID or URL"
            value={value.followup_ticket}
            onChange={(e) => set("followup_ticket", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="label-caps">Contact status</Label>
          <Select
            value={value.contact_status}
            onValueChange={(v) => set("contact_status", v as AccountHealth["contact_status"])}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_STATUSES.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="label-caps">Date contacted</Label>
          <Input
            type="date"
            value={value.date_contacted}
            onChange={(e) => set("date_contacted", e.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
