/**
 * Merchant Risk Assessment Engine
 * Deterministic, explainable, auditable scoring.
 */

export type ProductType = "Physical" | "Digital" | "Subscription";
export type DeliveryType = "Instant" | "Delayed";
export type BusinessModel = "Ecommerce" | "Marketplace" | "Wayflyer Referral" | "StoreHero Referral";
export type ProcessingHistory =
  | "No history"
  | "<6 months"
  | "6-12 months"
  | "1-3 years"
  | "3+ years";
export type BusinessMaturity = "MVP" | "<1 year" | "1-3 years" | "3+ years";
/** Email domain classification used by the IP & email quality factor. */
export type EmailDomainType =
  | "Verified corporate domain"
  | "Major free webmail (Gmail, Outlook, Yahoo, iCloud)"
  | "Other / less common free domain"
  | "Newly registered domain (<60 days) or no MX record"
  | "Disposable / temp-mail domain";

export const EMAIL_DOMAIN_TYPES: EmailDomainType[] = [
  "Verified corporate domain",
  "Major free webmail (Gmail, Outlook, Yahoo, iCloud)",
  "Other / less common free domain",
  "Newly registered domain (<60 days) or no MX record",
  "Disposable / temp-mail domain",
];

export const EMAIL_DOMAIN_SCORE: Record<EmailDomainType, number> = {
  "Verified corporate domain": 1,
  "Major free webmail (Gmail, Outlook, Yahoo, iCloud)": 2,
  "Other / less common free domain": 3,
  "Newly registered domain (<60 days) or no MX record": 4,
  "Disposable / temp-mail domain": 5,
};
/** Risk levels. Colour is presentation-only: Low = green, Medium = orange, High = red. */
export type Category = "LOW" | "MEDIUM" | "HIGH" | "REJECTED";
export type Variance = "ACCURATE" | "FALSE POSITIVE" | "UNDER-ESTIMATED RISK";


export interface MerchantTicket {
  id: string;
  reference: string;
  summary: string;
}

export interface Merchant {
  name: string;
  merchant_email: string;
  merchant_website: string;
  /** Country of the ultimate beneficial owner (UBO). */
  merchant_country: string;
  operating_country: string;

  industry: string;
  email_domain_type: EmailDomainType;
  ip_fraud_score: number;
  stripe_account_exists: boolean;
  stripe_account_link: string;
  product_type: ProductType;
  delivery_type: DeliveryType;
  avg_order_value: number;
  business_model: BusinessModel;
  processing_history: ProcessingHistory;
  chargeback_rate: number;
  fraud_rate: number;
  refund_rate: number;
  business_maturity: BusinessMaturity;
  tickets: MerchantTicket[];
  internal_notes: string;
}

export interface Legitimacy {
  registered_business: boolean;
  website_live: boolean;
}

/* ------------------------------------------------------------------ */
/* Account health — operational only, never part of the risk score     */
/* ------------------------------------------------------------------ */

export const VERIFICATION_STATUSES = ["Complete", "Pending Documents", "Restricted"] as const;
export const ACCOUNT_IMPACTS = ["Payouts Blocked", "Payments Blocked", "Both"] as const;
export const CONTACT_STATUSES = ["Not Contacted", "Contacted", "Resolved"] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type AccountImpact = (typeof ACCOUNT_IMPACTS)[number];
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/**
 * Operational account-health record. Deliberately excluded from `runAssessment`
 * and every weighted factor — it is an operational alert, not a risk signal.
 */
export interface AccountHealth {
  verification_status: VerificationStatus;
  impact: AccountImpact | "";
  missing_items: string;
  followup_ticket: string;
  contact_status: ContactStatus;
  date_contacted: string;
}

export const EMPTY_ACCOUNT_HEALTH: AccountHealth = {
  verification_status: "Complete",
  impact: "",
  missing_items: "",
  followup_ticket: "",
  contact_status: "Not Contacted",
  date_contacted: "",
};


export interface ActualMetrics {
  fraud_rate: number;
  chargebacks: number;
  refunds: number;
  geo_behavior: "As expected" | "Minor drift" | "Significant drift";
}

export interface ScoreLine {
  label: string;
  value: number;
}

export interface ComponentScore {
  score: number;
  lines: ScoreLine[];
}

export interface Assessment {
  scores: {
    merchant_country: ComponentScore;
    industry_product: ComponentScore;
    business_model: ComponentScore;
    fraud_signals: ComponentScore;
    historical: ComponentScore;
    business_maturity: ComponentScore;
  };

  total_score: number;
  category: Category;
  monitoring_days: string;
  /** Populated when the industry is prohibited/restricted enough to auto-reject. */
  rejection_reason?: string;
}

export interface MerchantRecord {
  id: string;
  created_at: string;
  stage: 1 | 2 | 3;
  merchant: Merchant;
  legitimacy: Legitimacy;
  legitimacy_status: string;
  assessment: Assessment | null;
  stage2: {
    actual_metrics: ActualMetrics;
    actual_outcome: Category;
    variance: Variance;
    performance_score?: number;
    recalculated_total?: number;
    capped?: boolean;
    note?: string;
  } | null;

  final_decision: string | null;
  /** Operational only — excluded from scoring. */
  account_health?: AccountHealth;

}

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

/** Country list for dropdowns. Country risk is no longer tied to nationality. */
export const COUNTRIES = [
  "Australia",
  "Austria",
  "Belgium",
  "Belarus",
  "Brazil",
  "Bulgaria",
  "Cambodia",
  "Canada",
  "Chile",
  "Colombia",
  "Czech Republic",
  "Denmark",
  "Egypt",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "India",
  "Indonesia",
  "Iran",
  "Ireland",
  "Israel",
  "Italy",
  "Japan",
  "Malaysia",
  "Mexico",
  "Myanmar",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Norway",
  "Pakistan",
  "Philippines",
  "Poland",
  "Portugal",
  "Romania",
  "Russia",
  "Saudi Arabia",
  "Singapore",
  "South Africa",
  "South Korea",
  "Spain",
  "Sweden",
  "Switzerland",
  "Turkey",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Venezuela",
  "Vietnam",
].sort();

/**
 * Industry catalogue.
 * `status` follows Stripe's restricted businesses list:
 * https://stripe.com/ie/legal/restricted-businesses
 *  - "prohibited": never onboard → automatic Rejected
 *  - "restricted": conditional / high-risk → automatic Rejected pending approval
 *  - "allowed": scored normally
 */
export type IndustryStatus = "allowed" | "restricted" | "prohibited";

export interface IndustryDef {
  name: string;
  risk: number;
  status: IndustryStatus;
}

export const INDUSTRY_CATALOG: IndustryDef[] = [
  { name: "Retail / eCommerce", risk: 2, status: "allowed" },
  { name: "Grocery & Food", risk: 1, status: "allowed" },
  { name: "Fashion & Apparel", risk: 2, status: "allowed" },
  { name: "Electronics", risk: 3, status: "allowed" },
  { name: "SaaS / Software", risk: 2, status: "allowed" },
  { name: "Digital Content & Media", risk: 3, status: "allowed" },
  { name: "Online Education", risk: 3, status: "allowed" },
  { name: "Travel & Tourism", risk: 4, status: "allowed" },
  { name: "Events & Ticketing", risk: 4, status: "allowed" },
  { name: "Health & Wellness", risk: 3, status: "allowed" },
  { name: "Beauty & Cosmetics", risk: 3, status: "allowed" },
  { name: "Home & Furniture", risk: 2, status: "allowed" },
  { name: "Automotive", risk: 3, status: "allowed" },
  { name: "Telecoms", risk: 3, status: "allowed" },
  { name: "Professional Services", risk: 2, status: "allowed" },
  { name: "Marketplace Services", risk: 3, status: "allowed" },
  { name: "Charity / Non-profit", risk: 2, status: "allowed" },
  // Stripe restricted / conditional categories
  { name: "Supplements & Nutraceuticals", risk: 4, status: "restricted" },
  { name: "CBD & Hemp Products", risk: 5, status: "restricted" },
  { name: "Gambling & Betting", risk: 5, status: "restricted" },
  { name: "Crypto & Digital Assets", risk: 5, status: "restricted" },
  { name: "Financial Services / Lending", risk: 4, status: "restricted" },
  { name: "Adult Content", risk: 5, status: "restricted" },
  { name: "Gaming & eSports (real money)", risk: 4, status: "restricted" },
  { name: "Tobacco, E-cigarettes & Vapes", risk: 5, status: "restricted" },
  { name: "Alcohol", risk: 4, status: "restricted" },
  { name: "Firearms, Weapons & Ammunition", risk: 5, status: "restricted" },
  { name: "Pharmaceuticals & Prescription Drugs", risk: 5, status: "restricted" },
  { name: "Debt Collection & Credit Repair", risk: 5, status: "restricted" },
  // Stripe prohibited categories
  { name: "Illegal Drugs & Paraphernalia", risk: 5, status: "prohibited" },
  { name: "Counterfeit & IP-infringing Goods", risk: 5, status: "prohibited" },
  { name: "Multi-level Marketing / Pyramid Schemes", risk: 5, status: "prohibited" },
  { name: "Get-rich-quick Schemes", risk: 5, status: "prohibited" },
  { name: "Human Trafficking & Exploitation", risk: 5, status: "prohibited" },
  { name: "Endangered Species & Protected Wildlife", risk: 5, status: "prohibited" },
  { name: "Unlicensed Money Transmission", risk: 5, status: "prohibited" },
  { name: "Shell Banks & Unregistered Charities", risk: 5, status: "prohibited" },
];

export const INDUSTRIES = INDUSTRY_CATALOG.map((i) => i.name);

export function industryDef(name: string): IndustryDef {
  return INDUSTRY_CATALOG.find((i) => i.name === name) ?? { name, risk: 3, status: "allowed" };
}

export const STRIPE_RESTRICTED_URL = "https://stripe.com/ie/legal/restricted-businesses";

export const WEIGHTS = {
  merchant_country: 0.18,
  industry_product: 0.25,
  business_model: 0.05,
  fraud_signals: 0.12,
  historical: 0.2,
  business_maturity: 0.2,
} as const;


/** Thresholds used for "high" flags in historical, AOV and fraud-signal scoring. */
export const THRESHOLDS = {
  chargeback_high: 0.9, // %
  fraud_high: 0.5, // %
  refund_high: 8, // %
  aov_high: 250, // currency units
  fraud_signal_high: 80, // email/IP fraud score
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function countryScore(country: string): number {
  return COUNTRY_RISK[country] ?? 3;
}

/* ------------------------------------------------------------------ */
/* Step 1 — Legitimacy hard gate                                       */
/* ------------------------------------------------------------------ */

export function checkLegitimacy(l: Legitimacy): { passed: boolean; status: string; failures: string[] } {
  const labels: Record<keyof Legitimacy, string> = {
    registered_business: "Registered business",
    website_live: "Website live",
  };
  const failures = (Object.keys(labels) as (keyof Legitimacy)[])
    .filter((k) => !l[k])
    .map((k) => labels[k]);

  return failures.length > 0
    ? { passed: false, status: "REJECTED - LEGITIMACY FAILURE", failures }
    : { passed: true, status: "PASSED - LEGITIMACY VERIFIED", failures };
}

/* ------------------------------------------------------------------ */
/* Industry gate                                                       */
/* ------------------------------------------------------------------ */

export function checkIndustry(industry: string): { rejected: boolean; reason?: string } {
  const def = industryDef(industry);
  if (def.status === "prohibited") {
    return {
      rejected: true,
      reason: `Prohibited industry (${def.name}) under Stripe restricted businesses policy.`,
    };
  }
  if (def.status === "restricted") {
    return {
      rejected: true,
      reason: `Restricted industry (${def.name}) under Stripe restricted businesses policy — requires explicit approval.`,
    };
  }
  return { rejected: false };
}

/* ------------------------------------------------------------------ */
/* Factor 1 — Geographic consistency (UBO country vs operating country) */
/* ------------------------------------------------------------------ */

function scoreGeographicConsistency(m: Merchant): ComponentScore {
  const base = countryScore(m.merchant_country);
  const lines: ScoreLine[] = [{ label: `UBO country risk tier (${m.merchant_country})`, value: base }];
  let score = base;
  if (m.merchant_country !== m.operating_country) {
    score += 0.5;
    lines.push({
      label: `UBO / operating mismatch (${m.merchant_country} ≠ ${m.operating_country})`,
      value: 0.5,
    });
  }
  return { score: round2(clamp(score, 1, 5)), lines };
}


/* ------------------------------------------------------------------ */
/* 4.3 Industry / product                                              */
/* ------------------------------------------------------------------ */

function scoreIndustryProduct(m: Merchant): ComponentScore {
  const def = industryDef(m.industry);
  const lines: ScoreLine[] = [{ label: `Base industry risk (${def.name})`, value: def.risk }];
  let score = def.risk;

  if (def.status === "restricted") {
    score += 1;
    lines.push({ label: "Stripe restricted category", value: 1 });
  }
  if (def.status === "prohibited") {
    score += 2;
    lines.push({ label: "Stripe prohibited category", value: 2 });
  }
  if (m.product_type === "Digital") {
    score += 0.5;
    lines.push({ label: "Digital product", value: 0.5 });
  }
  if (m.product_type === "Subscription") {
    score += 0.5;
    lines.push({ label: "Subscription product", value: 0.5 });
  }
  if (m.delivery_type === "Instant") {
    score += 0.3;
    lines.push({ label: "Instant delivery", value: 0.3 });
  }
  if (m.avg_order_value >= THRESHOLDS.aov_high) {
    score += 0.3;
    lines.push({ label: `High average order value (≥ ${THRESHOLDS.aov_high})`, value: 0.3 });
  }

  return { score: round2(clamp(score, 1, 5)), lines };
}

/* ------------------------------------------------------------------ */
/* 4.4 Business model                                                  */
/* ------------------------------------------------------------------ */

function scoreBusinessModel(m: Merchant): ComponentScore {
  const lines: ScoreLine[] = [{ label: "Base business model score", value: 3 }];
  let score = 3;

  if (m.business_model === "Marketplace") {
    score += 1;
    lines.push({ label: "Marketplace model", value: 1 });
  }
  if (m.business_model === "Wayflyer Referral" || m.business_model === "StoreHero Referral") {
    score -= 0.5;
    lines.push({ label: `Vetted partner referral (${m.business_model})`, value: -0.5 });
  }

  return { score: round2(clamp(score, 1, 5)), lines };
}

/* ------------------------------------------------------------------ */
/* 4.5 IP & email quality signals                                      */
/* ------------------------------------------------------------------ */

/** Banded IP fraud sub-score (1-5). */
export function ipSubScore(v: number): number {
  const n = clamp(Number(v) || 0, 0, 100);
  if (n <= 30) return 1;
  if (n <= 50) return 2;
  if (n <= 70) return 3;
  if (n <= 80) return 4;
  return 5;
}

/** Extracts a bare domain from an email address or website URL. */
export function extractDomain(value: string): string {
  const v = (value || "").trim().toLowerCase();
  if (!v) return "";
  const afterAt = v.includes("@") ? v.split("@").pop()! : v;
  const host = afterAt.replace(/^[a-z]+:\/\//, "").split("/")[0]!.split("?")[0]!;
  return host.replace(/^www\./, "").replace(/\.$/, "");
}

function scoreFraudSignals(m: Merchant): ComponentScore {
  const ipRaw = clamp(Number(m.ip_fraud_score) || 0, 0, 100);
  const ip = ipSubScore(ipRaw);

  const domainType: EmailDomainType = m.email_domain_type ?? "Other / less common free domain";
  let email = EMAIL_DOMAIN_SCORE[domainType] ?? 3;

  const lines: ScoreLine[] = [
    { label: `IP fraud score ${ipRaw} → sub-score`, value: ip },
    { label: `Email domain: ${domainType}`, value: email },
  ];

  const isFreeWebmail = domainType === "Major free webmail (Gmail, Outlook, Yahoo, iCloud)";
  const emailDomain = extractDomain(m.merchant_email);
  const siteDomain = extractDomain(m.merchant_website);
  if (!isFreeWebmail && emailDomain && siteDomain && emailDomain !== siteDomain) {
    email = Math.min(5, email + 1);
    lines.push({
      label: `Identity mismatch (${emailDomain} ≠ ${siteDomain})`,
      value: 1,
    });
  }

  let score = Math.max(ip, email);
  lines.push({ label: "Combined (higher of IP / email)", value: score });

  if (ipRaw > THRESHOLDS.fraud_signal_high) {
    score = Math.min(5, score + 0.5);
    lines.push({ label: `IP fraud score above ${THRESHOLDS.fraud_signal_high}`, value: 0.5 });
  }

  return { score: round2(clamp(score, 1, 5)), lines };
}

/* ------------------------------------------------------------------ */
/* 4.6 Historical performance                                          */
/* ------------------------------------------------------------------ */

const HISTORY_SCORE: Record<ProcessingHistory, number> = {
  "No history": 3,
  "<6 months": 3,
  "6-12 months": 2.5,
  "1-3 years": 2,
  "3+ years": 1,
};

function scoreHistorical(m: Merchant): ComponentScore {
  const base = HISTORY_SCORE[m.processing_history];
  const lines: ScoreLine[] = [{ label: `Processing history baseline (${m.processing_history})`, value: base }];
  let score = base;

  if (m.chargeback_rate > THRESHOLDS.chargeback_high) {
    score += 1;
    lines.push({ label: `High chargeback rate (${m.chargeback_rate}%)`, value: 1 });
  }
  if (m.fraud_rate > THRESHOLDS.fraud_high) {
    score += 1;
    lines.push({ label: `High fraud rate (${m.fraud_rate}%)`, value: 1 });
  }
  if (m.refund_rate > THRESHOLDS.refund_high) {
    score += 0.5;
    lines.push({ label: `High refund rate (${m.refund_rate}%)`, value: 0.5 });
  }

  const clean =
    m.processing_history === "3+ years" &&
    m.chargeback_rate <= THRESHOLDS.chargeback_high &&
    m.fraud_rate <= THRESHOLDS.fraud_high &&
    m.refund_rate <= THRESHOLDS.refund_high;
  if (clean) {
    score -= 0.5;
    lines.push({ label: "Strong history (3+ years clean)", value: -0.5 });
  }

  return { score: round2(clamp(score, 1, 5)), lines };
}

/* ------------------------------------------------------------------ */
/* Factor 6 — Business maturity                                        */
/* ------------------------------------------------------------------ */

const MATURITY_SCORE: Record<BusinessMaturity, number> = {
  MVP: 5,
  "<1 year": 4,
  "1-3 years": 3,
  "3+ years": 2,
};


function scoreMaturity(m: Merchant): ComponentScore {
  const score = MATURITY_SCORE[m.business_maturity];
  return { score, lines: [{ label: `Business maturity (${m.business_maturity})`, value: score }] };
}

/* ------------------------------------------------------------------ */
/* Category + monitoring                                               */
/* ------------------------------------------------------------------ */

export function categorise(score: number): Category {
  if (score <= 2.0) return "LOW";
  if (score <= 3.5) return "MEDIUM";
  return "HIGH";
}

export const MONITORING: Record<Category, string> = {
  LOW: "21 days",
  MEDIUM: "60 days",
  HIGH: "120 days",
  REJECTED: "Not applicable",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  REJECTED: "Rejected",
};

export function runAssessment(m: Merchant): Assessment {
  const scores = {
    merchant_country: scoreGeographicConsistency(m),
    industry_product: scoreIndustryProduct(m),
    business_model: scoreBusinessModel(m),
    fraud_signals: scoreFraudSignals(m),
    historical: scoreHistorical(m),
    business_maturity: scoreMaturity(m),
  };

  const total = round2(
    scores.merchant_country.score * WEIGHTS.merchant_country +
      scores.industry_product.score * WEIGHTS.industry_product +
      scores.business_model.score * WEIGHTS.business_model +
      scores.fraud_signals.score * WEIGHTS.fraud_signals +
      scores.historical.score * WEIGHTS.historical +
      scores.business_maturity.score * WEIGHTS.business_maturity,
  );

  const industryGate = checkIndustry(m.industry);
  const category: Category = industryGate.rejected ? "REJECTED" : categorise(total);

  return {
    scores,
    total_score: total,
    category,
    monitoring_days: MONITORING[category],
    ...(industryGate.reason ? { rejection_reason: industryGate.reason } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Stage 2 — observed behaviour, performance-first                      */
/* ------------------------------------------------------------------ */

const CATEGORY_RANK: Record<Category, number> = { REJECTED: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };

/**
 * Observed Historical Performance sub-score (1-5) derived purely from realised
 * losses — fraud, chargebacks and refunds. Geographic drift is deliberately
 * excluded: dispersion is not a loss.
 */
export function observedPerformanceScore(a: ActualMetrics): number {
  let score = 1;
  if (a.fraud_rate > 1) score += 2;
  else if (a.fraud_rate > THRESHOLDS.fraud_high) score += 1;

  if (a.chargebacks > 1.5) score += 2;
  else if (a.chargebacks > THRESHOLDS.chargeback_high) score += 1;

  if (a.refunds > 15) score += 1;
  else if (a.refunds > THRESHOLDS.refund_high) score += 0.5;

  return round2(clamp(score, 1, 5));
}

/** Derives an observed risk category from realised losses only. */
export function observedCategory(a: ActualMetrics): Category {
  const p = observedPerformanceScore(a);
  if (p <= 2.0) return "LOW";
  if (p <= 3.0) return "MEDIUM";
  return "HIGH";
}

export interface Stage2Evaluation {
  performance_score: number;
  performance_healthy: boolean;
  actual_outcome: Category;
  variance: Variance;
  stage1_total: number;
  recalculated_total: number;
  /** True when an upward recalculation was suppressed by the performance-first rule. */
  capped: boolean;
  geo_drift: ActualMetrics["geo_behavior"];
  note: string;
}

/**
 * Performance-first override: the total risk score may only rise when the
 * observed Historical Performance score rises above the Stage 1 score.
 * Geographic drift alone never pushes the total upward while performance is
 * healthy (performance score ≤ 3.0) — Stage 1 remains the ceiling.
 */
export function evaluateStage2(assessment: Assessment, a: ActualMetrics): Stage2Evaluation {
  const performance = observedPerformanceScore(a);
  const healthy = performance <= 3.0;
  const stage1Historical = assessment.scores.historical.score;
  const stage1Total = assessment.total_score;

  const performanceWorsened = performance > stage1Historical;
  const rescored = round2(
    stage1Total + (performance - stage1Historical) * WEIGHTS.historical,
  );

  let recalculated = stage1Total;
  let capped = false;
  let note = "Performance in line with Stage 1 — score unchanged.";

  if (performanceWorsened) {
    recalculated = round2(clamp(rescored, 1, 5));
    note = `Realised losses worsened (performance ${stage1Historical.toFixed(2)} → ${performance.toFixed(2)}) — score recalculated upward.`;
  } else if (healthy && a.geo_behavior !== "As expected") {
    capped = true;
    note = `Geographic drift observed (${a.geo_behavior}) but performance is healthy (${performance.toFixed(2)} ≤ 3.0) — Stage 1 score held as the ceiling.`;
  } else if (performance < stage1Historical) {
    recalculated = round2(clamp(rescored, 1, 5));
    note = `Performance better than predicted (${stage1Historical.toFixed(2)} → ${performance.toFixed(2)}) — score revised downward.`;
  }

  const outcome = observedCategory(a);
  const cappedOutcome: Category =
    capped && CATEGORY_RANK[outcome] > CATEGORY_RANK[assessment.category]
      ? assessment.category
      : outcome;

  return {
    performance_score: performance,
    performance_healthy: healthy,
    actual_outcome: cappedOutcome,
    variance: compareStage2(assessment.category, cappedOutcome),
    stage1_total: stage1Total,
    recalculated_total: recalculated,
    capped,
    geo_drift: a.geo_behavior,
    note,
  };
}

export function compareStage2(expected: Category, actual: Category): Variance {
  const d = CATEGORY_RANK[actual] - CATEGORY_RANK[expected];
  if (d === 0) return "ACCURATE";
  return d < 0 ? "FALSE POSITIVE" : "UNDER-ESTIMATED RISK";
}


/* ------------------------------------------------------------------ */
/* Stage 3 — decision engine                                           */
/* ------------------------------------------------------------------ */

export function decide(expected: Category, variance: Variance): string {
  if (expected === "REJECTED") return "REJECTED - NOT ONBOARDED";
  if (expected === "HIGH" || variance === "UNDER-ESTIMATED RISK") return "ESCALATE / RESTRICT";
  return "STANDARD TERMS";
}
