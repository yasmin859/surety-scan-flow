/**
 * Merchant Risk Assessment Engine
 * Deterministic, explainable, auditable scoring.
 */

export type ProductType = "Physical" | "Digital" | "Subscription";
export type Refundability = "Easy" | "Moderate" | "Difficult";
export type DeliveryType = "Instant" | "Delayed";
export type BusinessModel = "Direct" | "Marketplace" | "Aggregator" | "Dropshipping";
export type SellerControls = "Strong" | "Moderate" | "Weak";
export type PaymentFlow = "Merchant controls funds" | "Third-party controls funds";
export type Fulfilment = "Merchant fulfils" | "Shared responsibility" | "Third-party fulfils";
export type ProcessingHistory =
  | "No history"
  | "<6 months"
  | "6-12 months"
  | "1-3 years"
  | "3+ years";
export type BusinessMaturity = "MVP" | "<1 year" | "1-3 years" | "3+ years";
export type Category = "LOW" | "MEDIUM" | "ORANGE" | "RED";
export type Variance = "ACCURATE" | "FALSE POSITIVE" | "UNDER-ESTIMATED RISK";

export interface CustomerCountry {
  country: string;
  percentage: number;
}

export interface Merchant {
  name: string;
  merchant_country: string;
  operating_country: string;
  customer_distribution: CustomerCountry[];
  industry: string;
  product_type: ProductType;
  refundability: Refundability;
  delivery_type: DeliveryType;
  avg_order_value: number;
  business_model: BusinessModel;
  seller_controls: SellerControls;
  payment_flow: PaymentFlow;
  fulfilment: Fulfilment;
  processing_history: ProcessingHistory;
  chargeback_rate: number;
  fraud_rate: number;
  refund_rate: number;
  business_maturity: BusinessMaturity;
}

export interface Legitimacy {
  registered_business: boolean;
  website_live: boolean;
  ownership_verified: boolean;
  activity_matches_description: boolean;
}

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
    customer_exposure: ComponentScore;
    industry_product: ComponentScore;
    business_model: ComponentScore;
    historical: ComponentScore;
    business_maturity: ComponentScore;
  };
  total_score: number;
  category: Category;
  monitoring_days: string;
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
  } | null;
  final_decision: string | null;
}

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

/** Predefined country risk scores (1 = lowest risk, 5 = highest). */
export const COUNTRY_RISK: Record<string, number> = {
  "United Kingdom": 1,
  Ireland: 1,
  Germany: 1,
  France: 1,
  Netherlands: 1,
  Sweden: 1,
  Norway: 1,
  Denmark: 1,
  Switzerland: 1,
  Austria: 1,
  Belgium: 1,
  Finland: 1,
  Canada: 1,
  Australia: 1,
  "New Zealand": 1,
  Japan: 1,
  Singapore: 1,
  "United States": 2,
  Spain: 2,
  Italy: 2,
  Portugal: 2,
  Poland: 2,
  "Czech Republic": 2,
  "South Korea": 2,
  "United Arab Emirates": 3,
  Malaysia: 3,
  Romania: 3,
  Bulgaria: 3,
  Greece: 3,
  Mexico: 3,
  Chile: 3,
  "Saudi Arabia": 3,
  Israel: 3,
  Brazil: 4,
  India: 4,
  Turkey: 4,
  Indonesia: 4,
  Philippines: 4,
  "South Africa": 4,
  Ukraine: 4,
  Colombia: 4,
  Egypt: 4,
  Vietnam: 4,
  Nigeria: 5,
  Pakistan: 5,
  Venezuela: 5,
  Russia: 5,
  Belarus: 5,
  Iran: 5,
  Myanmar: 5,
  Cambodia: 5,
};

export const COUNTRIES = Object.keys(COUNTRY_RISK).sort();

/** Predefined base industry risk scores. */
export const INDUSTRY_RISK: Record<string, number> = {
  "Retail / eCommerce": 2,
  "Grocery & Food": 1,
  "Fashion & Apparel": 2,
  Electronics: 3,
  "SaaS / Software": 2,
  "Digital Content & Media": 3,
  "Online Education": 3,
  "Travel & Tourism": 4,
  Ticketing2: 4,
  "Events & Ticketing": 4,
  "Health & Wellness": 3,
  Supplements: 4,
  "Beauty & Cosmetics": 3,
  "Gaming & eSports": 4,
  Gambling: 5,
  "Crypto & Digital Assets": 5,
  "Financial Services": 4,
  "Adult Content": 5,
  "Nutraceuticals / CBD": 5,
  "Marketplace Services": 3,
  "Professional Services": 2,
  "Home & Furniture": 2,
  Automotive: 3,
  Telecoms: 3,
  "Charity / Non-profit": 2,
};

export const INDUSTRIES = Object.keys(INDUSTRY_RISK).sort();

export const WEIGHTS = {
  merchant_country: 0.18,
  customer_exposure: 0.27,
  industry_product: 0.23,
  business_model: 0.14,
  historical: 0.08,
  business_maturity: 0.1,
} as const;

/** Thresholds used for "high" flags in historical & AOV scoring. */
export const THRESHOLDS = {
  chargeback_high: 0.9, // %
  fraud_high: 0.5, // %
  refund_high: 8, // %
  aov_high: 250, // currency units
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
    ownership_verified: "Ownership verified",
    activity_matches_description: "Activity matches description",
  };
  const failures = (Object.keys(labels) as (keyof Legitimacy)[])
    .filter((k) => !l[k])
    .map((k) => labels[k]);

  return failures.length > 0
    ? { passed: false, status: "REJECTED - LEGITIMACY FAILURE", failures }
    : { passed: true, status: "PASSED - LEGITIMACY VERIFIED", failures };
}

/* ------------------------------------------------------------------ */
/* 4.1 Merchant country                                                */
/* ------------------------------------------------------------------ */

function scoreMerchantCountry(m: Merchant): ComponentScore {
  const base = countryScore(m.merchant_country);
  const lines: ScoreLine[] = [{ label: `Base country risk (${m.merchant_country})`, value: base }];
  let score = base;
  if (m.merchant_country !== m.operating_country) {
    score += 0.5;
    lines.push({ label: `Jurisdiction mismatch (operates in ${m.operating_country})`, value: 0.5 });
  }
  return { score: round2(clamp(score, 1, 5)), lines };
}

/* ------------------------------------------------------------------ */
/* 4.2 Customer exposure                                               */
/* ------------------------------------------------------------------ */

function scoreCustomerExposure(m: Merchant): ComponentScore {
  const top5 = [...m.customer_distribution]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5)
    .filter((c) => c.country && c.percentage > 0);

  const lines: ScoreLine[] = [];
  if (top5.length === 0) {
    return { score: 3, lines: [{ label: "No customer distribution provided (neutral)", value: 3 }] };
  }

  const totalPct = top5.reduce((s, c) => s + c.percentage, 0);
  const weighted = top5.reduce((s, c) => s + countryScore(c.country) * (c.percentage / totalPct), 0);
  let score = weighted;
  lines.push({ label: `Weighted top-${top5.length} country exposure`, value: round2(weighted) });

  const highRiskPct = top5
    .filter((c) => countryScore(c.country) >= 4)
    .reduce((s, c) => s + c.percentage, 0);
  if (highRiskPct > 40) {
    score += 0.5;
    lines.push({ label: `${round2(highRiskPct)}% volume in high-risk countries (>40%)`, value: 0.5 });
  }

  const activeCountries = m.customer_distribution.filter((c) => c.country && c.percentage > 0).length;
  if (activeCountries > 3) {
    score += 0.3;
    lines.push({ label: `Highly cross-border (${activeCountries} countries)`, value: 0.3 });
  }

  return { score: round2(clamp(score, 1, 5)), lines };
}

/* ------------------------------------------------------------------ */
/* 4.3 Industry / product                                              */
/* ------------------------------------------------------------------ */

function scoreIndustryProduct(m: Merchant): ComponentScore {
  const base = INDUSTRY_RISK[m.industry] ?? 3;
  const lines: ScoreLine[] = [{ label: `Base industry risk (${m.industry})`, value: base }];
  let score = base;

  if (m.product_type === "Digital") {
    score += 0.5;
    lines.push({ label: "Digital product", value: 0.5 });
  }
  if (m.product_type === "Subscription") {
    score += 0.5;
    lines.push({ label: "Subscription product", value: 0.5 });
  }
  if (m.refundability === "Difficult") {
    score += 0.5;
    lines.push({ label: "Difficult refundability", value: 0.5 });
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
  if (m.business_model === "Dropshipping") {
    score += 0.5;
    lines.push({ label: "Dropshipping model", value: 0.5 });
  }
  if (m.seller_controls === "Weak") {
    score += 0.5;
    lines.push({ label: "Weak seller controls", value: 0.5 });
  }
  if (m.payment_flow === "Third-party controls funds") {
    score += 0.5;
    lines.push({ label: "Third-party controls funds", value: 0.5 });
  }
  if (m.fulfilment === "Third-party fulfils") {
    score += 0.5;
    lines.push({ label: "Third-party fulfils", value: 0.5 });
  }

  return { score: round2(clamp(score, 1, 5)), lines };
}

/* ------------------------------------------------------------------ */
/* 4.5 Historical performance                                          */
/* ------------------------------------------------------------------ */

function scoreHistorical(m: Merchant): ComponentScore {
  if (m.processing_history === "No history") {
    return { score: 3, lines: [{ label: "No processing history (neutral)", value: 3 }] };
  }

  const lines: ScoreLine[] = [{ label: "Baseline with processing history", value: 3 }];
  let score = 3;

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
/* 4.6 Business maturity                                               */
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
  if (score <= 3.0) return "MEDIUM";
  if (score <= 4.0) return "ORANGE";
  return "RED";
}

export const MONITORING: Record<Category, string> = {
  LOW: "21 days",
  MEDIUM: "60 days",
  ORANGE: "90-120 days",
  RED: "120+ days + strict monitoring",
};

export function runAssessment(m: Merchant): Assessment {
  const scores = {
    merchant_country: scoreMerchantCountry(m),
    customer_exposure: scoreCustomerExposure(m),
    industry_product: scoreIndustryProduct(m),
    business_model: scoreBusinessModel(m),
    historical: scoreHistorical(m),
    business_maturity: scoreMaturity(m),
  };

  const total = round2(
    scores.merchant_country.score * WEIGHTS.merchant_country +
      scores.customer_exposure.score * WEIGHTS.customer_exposure +
      scores.industry_product.score * WEIGHTS.industry_product +
      scores.business_model.score * WEIGHTS.business_model +
      scores.historical.score * WEIGHTS.historical +
      scores.business_maturity.score * WEIGHTS.business_maturity,
  );

  const category = categorise(total);
  return { scores, total_score: total, category, monitoring_days: MONITORING[category] };
}

/* ------------------------------------------------------------------ */
/* Stage 2 — observed behaviour                                        */
/* ------------------------------------------------------------------ */

const CATEGORY_RANK: Record<Category, number> = { LOW: 1, MEDIUM: 2, ORANGE: 3, RED: 4 };

/** Derives an observed risk category from live monitoring metrics. */
export function observedCategory(a: ActualMetrics): Category {
  let points = 0;
  if (a.fraud_rate > 1) points += 2;
  else if (a.fraud_rate > THRESHOLDS.fraud_high) points += 1;

  if (a.chargebacks > 1.5) points += 2;
  else if (a.chargebacks > THRESHOLDS.chargeback_high) points += 1;

  if (a.refunds > 15) points += 2;
  else if (a.refunds > THRESHOLDS.refund_high) points += 1;

  if (a.geo_behavior === "Significant drift") points += 2;
  else if (a.geo_behavior === "Minor drift") points += 1;

  if (points === 0) return "LOW";
  if (points <= 2) return "MEDIUM";
  if (points <= 4) return "ORANGE";
  return "RED";
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
  if (expected === "RED" || variance === "UNDER-ESTIMATED RISK") return "ESCALATE / RESTRICT";
  if (expected === "ORANGE") return "ADJUST TERMS or EXTEND";
  if ((expected === "LOW" || expected === "MEDIUM") && variance === "ACCURATE") return "STANDARD TERMS";
  return "STANDARD TERMS";
}
