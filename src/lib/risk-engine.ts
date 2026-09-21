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
  business_maturity: BusinessMaturity;
  tickets: MerchantTicket[];
  internal_notes: string;
}

export interface Legitimacy {
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
  /** Link to the Stripe connected account — captured at monitoring time. */
  connected_account_link?: string;
}

export const EMPTY_ACCOUNT_HEALTH: AccountHealth = {
  verification_status: "Complete",
  impact: "",
  missing_items: "",
  followup_ticket: "",
  contact_status: "Not Contacted",
  date_contacted: "",
  connected_account_link: "",
};


export interface ActualMetrics {
  chargebacks: number;
  /** Complaint rate (%) observed during monitoring. */
  complaints: number;
  /** Monitoring fraud score (0–1 scale) used as a risk threshold/override. */
  fraud_score?: number;
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
  /** Stage 3 actions chosen by the agent, with reserve amount / pause date. */
  decision_actions?: DecisionActions;
  /** Operational only — excluded from scoring. */
  account_health?: AccountHealth;
  /** Chronological assessment history — newest entry last. Never overwritten. */
  history?: AssessmentEntry[];
}

/**
 * One point-in-time assessment for a merchant. The first entry is always the
 * Stage 1 initial assessment; every monitoring update appends a new entry.
 */
export interface AssessmentEntry {
  id: string;
  /** "Initial Assessment", "Assessment 2", … */
  label: string;
  date: string;
  kind: "initial" | "monitoring";
  metrics: ActualMetrics | null;
  total_score: number;
  category: Category;
  actions: string[];
}

/** The only risk controls an agent can apply at Stage 3. */
export const ACTION_OPTIONS = [
  "Standard Terms",
  "Increase monitoring",
  "Add Reserve",
  "Pause Payout",
] as const;

export type RiskAction = (typeof ACTION_OPTIONS)[number];

/** Actions selected by the agent, with their parameters. */
export interface DecisionActions {
  actions: string[];
  /** Amount held as reserve, when "Add Reserve" is selected. */
  reserve_amount?: number | undefined;
  /** ISO date (yyyy-mm-dd) the payout pause runs until, when "Pause Payout" is selected. */
  pause_until?: string | undefined;
}

/** Recommended risk controls for a category — Stage 3 playbook. */
export function recommendedActions(category: Category): string[] {
  switch (category) {
    case "LOW":
      return ["Standard Terms"];
    case "MEDIUM":
      return ["Add Reserve", "Increase monitoring"];
    case "HIGH":
      return ["Add Reserve", "Pause Payout", "Increase monitoring"];
    default:
      return ["Not onboarded — rejected at assessment"];
  }
}

export function nextAssessmentLabel(history: AssessmentEntry[]): string {
  return history.length === 0 ? "Initial Assessment" : `Assessment ${history.length + 1}`;
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
  // 1. Digital items
  { name: "Digital assets", risk: 5, status: "allowed" },
  { name: "Digital services", risk: 3, status: "allowed" },
  { name: "Digital event ticket resales", risk: 4, status: "allowed" },
  // 2. Physical items
  { name: "Vehicle sales", risk: 4, status: "allowed" },
  { name: "Animals / pets", risk: 4, status: "allowed" },
  { name: "Clothes and fashion accessories", risk: 2, status: "allowed" },
  { name: "Furniture and home goods", risk: 2, status: "allowed" },
  { name: "Collectibles and memorabilia", risk: 4, status: "allowed" },
  { name: "Electronics and gadgets", risk: 4, status: "allowed" },
  { name: "Custom or made-to-order goods", risk: 2, status: "allowed" },
  { name: "Tools, equipment and instruments", risk: 3, status: "allowed" },
  { name: "Luxury items and fine jewellery", risk: 5, status: "allowed" },
  { name: "Art", risk: 5, status: "allowed" },
  { name: "Bulk and raw materials", risk: 3, status: "allowed" },
  // 3. Services
  { name: "Vehicle reservation payments", risk: 4, status: "allowed" },
  { name: "Transport of persons", risk: 3, status: "allowed" },
  { name: "Transport of goods", risk: 3, status: "allowed" },
  { name: "Property rentals / accommodation", risk: 4, status: "allowed" },
  { name: "Construction Services", risk: 3, status: "allowed" },
  { name: "Other services (general)", risk: 2, status: "allowed" },
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
  { name: "Endangered Species & Protected Wildlife", risk: 5, status: "prohibited" },
  { name: "Unlicensed Money Transmission", risk: 5, status: "prohibited" },
  { name: "Shell Banks & Unregistered Charities", risk: 5, status: "prohibited" },
];

export const INDUSTRIES = INDUSTRY_CATALOG.map((i) => i.name);

export function industryDef(name: string): IndustryDef {
  const found = INDUSTRY_CATALOG.find((i) => i.name === name);
  if (found) return found;
  // Legacy records stored numbered names ("2.3 Clothes and fashion accessories") —
  // strip the numeric prefix so old assessments keep their original risk.
  const legacy = INDUSTRY_CATALOG.find((i) => i.name === name.replace(/^\d+(\.\d+)?\s+/, ""));
  if (legacy) return legacy;
  return { name, risk: 3, status: "allowed" };
}

export const STRIPE_RESTRICTED_URL = "https://stripe.com/ie/legal/restricted-businesses";

export const WEIGHTS = {
  merchant_country: 0.18,
  industry_product: 0.25,
  business_model: 0.1,
  fraud_signals: 0.12,
  historical: 0.2,
  business_maturity: 0.15,
} as const;


/** Thresholds used for "high" flags in historical and fraud-signal scoring. */
export const THRESHOLDS = {
  chargeback_high: 0.9, // %
  fraud_signal_high: 80, // email/IP fraud score
  /** Stage 2 monitoring fraud score bands (0–1 scale). */
  fraud_score_medium: 0.2,
  fraud_score_high: 0.5,
  /** Stage 2 complaint rate bands (%). */
  complaint_medium: 20,
  complaint_high: 40,
};


/** Tiered average-order-value penalty (replaces the old flat €250+ rule). */
export const AOV_TIERS: { min: number; max: number; penalty: number }[] = [
  { min: 250, max: 750, penalty: 0.3 },
  { min: 750, max: 1000, penalty: 0.5 },
  { min: 1000, max: 2000, penalty: 1.0 },
  { min: 2000, max: 5000, penalty: 2.0 },
  { min: 5000, max: Infinity, penalty: 3.5 },
];

export function aovPenalty(aov: number): { penalty: number; tierLabel: string } {
  const v = Number(aov) || 0;
  const tier = AOV_TIERS.find((t) => v >= t.min && v < t.max);
  if (!tier) return { penalty: 0, tierLabel: "" };
  const fmt = (n: number) => `€${n.toLocaleString("en-IE")}`;
  const upper = tier.max === Infinity ? "+" : ` to <${fmt(tier.max)}`;
  return { penalty: tier.penalty, tierLabel: `${fmt(tier.min)}${upper}` };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function countryScore(country: string): number {
  // All countries now share the same neutral baseline.
  return 2;
}

/* ------------------------------------------------------------------ */
/* Step 1 — Legitimacy hard gate                                       */
/* ------------------------------------------------------------------ */

export function checkLegitimacy(l: Legitimacy): { passed: boolean; status: string; failures: string[] } {
  const labels: Record<keyof Legitimacy, string> = {
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
  const matched = m.merchant_country === m.operating_country;
  if (matched) {
    return {
      score: 1,
      lines: [{ label: "UBO and Operations are in the same jurisdiction (Consistent)", value: 1 }],
    };
  }
  return {
    score: 2,
    lines: [
      {
        label: `UBO and Operations are in different jurisdictions. Complexity score set to 2.0 (Low Risk).`,
        value: 2,
      },
    ],
  };
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
  const aovTier = aovPenalty(m.avg_order_value);
  if (aovTier.penalty > 0) {
    score += aovTier.penalty;
    lines.push({
      label: `Average order value (${aovTier.tierLabel})`,
      value: aovTier.penalty,
    });
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

function scoreFraudSignals(m: Merchant): ComponentScore {
  const ipRaw = clamp(Number(m.ip_fraud_score) || 0, 0, 100);
  const ip = ipSubScore(ipRaw);

  const domainType: EmailDomainType = m.email_domain_type ?? "Other / less common free domain";
  const email = EMAIL_DOMAIN_SCORE[domainType] ?? 3;

  const lines: ScoreLine[] = [
    { label: `IP fraud score ${ipRaw} → sub-score`, value: ip },
    { label: `Email domain: ${domainType}`, value: email },
  ];

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
  "No history": 2,
  "<6 months": 2,
  "6-12 months": 1.5,
  "1-3 years": 1.2,
  "3+ years": 1,
};

function scoreHistorical(m: Merchant): ComponentScore {
  const base = HISTORY_SCORE[m.processing_history];
  const lines: ScoreLine[] = [
    { label: `Processing history baseline (${m.processing_history})`, value: base },
  ];
  return { score: round2(clamp(base, 1, 5)), lines };
}

/* ------------------------------------------------------------------ */
/* Factor 6 — Business maturity                                        */
/* ------------------------------------------------------------------ */

const MATURITY_SCORE: Record<BusinessMaturity, number> = {
  MVP: 5,
  "<1 year": 3,
  "1-3 years": 2,
  "3+ years": 1,
};


function scoreMaturity(m: Merchant): ComponentScore {
  const score = MATURITY_SCORE[m.business_maturity];
  return { score, lines: [{ label: `Business maturity (${m.business_maturity})`, value: score }] };
}

/* ------------------------------------------------------------------ */
/* Category + monitoring                                               */
/* ------------------------------------------------------------------ */

export function categorise(score: number): Category {
  if (score <= 2.5) return "LOW";
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
 * losses — chargebacks and refunds.
 */
export function observedPerformanceScore(a: ActualMetrics): number {
  let score = 1;
  if (a.chargebacks > THRESHOLDS.chargeback_high) score += 1;

  return round2(clamp(score, 1, 5));
}

/** Fraud score factor — a threshold/override, never added to another score. */
export function fraudScoreFactor(fraudScore?: number): Category {
  const f = Number(fraudScore) || 0;
  if (f >= THRESHOLDS.fraud_score_high) return "HIGH";
  if (f >= THRESHOLDS.fraud_score_medium) return "MEDIUM";
  return "LOW";
}

/** Complaint rate factor, calculated independently of the fraud score. */
export function complaintFactor(complaints?: number): Category {
  const c = Number(complaints) || 0;
  if (c > THRESHOLDS.complaint_high) return "HIGH";
  if (c > THRESHOLDS.complaint_medium) return "MEDIUM";
  return "LOW";
}

/**
 * Highest applicable risk level. Factors are never summed — two MEDIUM
 * factors stay MEDIUM. REJECTED always wins.
 */
export function escalateCategory(...categories: Category[]): Category {
  if (categories.includes("REJECTED")) return "REJECTED";
  return categories.reduce(
    (worst, c) => (CATEGORY_RANK[c] > CATEGORY_RANK[worst] ? c : worst),
    "LOW" as Category,
  );
}

/** Derives an observed risk category from realised losses only. */
export function observedCategory(a: ActualMetrics): Category {
  const p = observedPerformanceScore(a);
  const base: Category = p <= 2.0 ? "LOW" : p <= 3.0 ? "MEDIUM" : "HIGH";
  return escalateCategory(base, fraudScoreFactor(a.fraud_score), complaintFactor(a.complaints));
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
  note: string;
  /** Independent override factors. */
  fraud_factor: Category;
  complaint_factor: Category;
  /** Calculated risk before the fraud / complaint overrides. */
  calculated_category: Category;
  /** Highest of calculated risk, fraud factor and complaint factor. */
  final_category: Category;
  override_note: string;
}


/**
 * Performance-first override: the total risk score may only rise when the
 * observed Historical Performance score rises above the Stage 1 score.
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
  } else if (performance < stage1Historical) {
    recalculated = round2(clamp(rescored, 1, 5));
    note = `Performance better than predicted (${stage1Historical.toFixed(2)} → ${performance.toFixed(2)}) — score revised downward.`;
  }

  const outcome = observedCategory(a);

  return {
    performance_score: performance,
    performance_healthy: healthy,
    actual_outcome: outcome,
    variance: compareStage2(assessment.category, outcome),
    stage1_total: stage1Total,
    recalculated_total: recalculated,
    capped,
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
  if (expected === "MEDIUM" || expected === "HIGH" || variance === "UNDER-ESTIMATED RISK")
    return "UNDER MONITORING";
  return "STANDARD TERMS";
}
