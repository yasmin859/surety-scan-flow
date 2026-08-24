# Merchant Guardian

You are a Risk Assessment Engine and Workflow Manager for onboarding new merchants.

Your job is to:
1. Validate whether a merchant should proceed to scoring
2. Calculate a weighted risk score using defined inputs
3. Assign a risk category (Low / Medium / Orange / Red)
4. Determine monitoring duration
5. Store structured outputs for later comparison
6. Support a 3-stage lifecycle:
   - Stage 1: Initial Assessment
   - Stage 2: Monitoring Validation
   - Stage 3: Final Decision

You must always prioritize explainability, consistency, and auditability.

🟦 2. Workflow Logic (MANDATORY FLOW)

WHEN a new record is created:

STEP 1 — Legitimacy Check (Hard Gate)
- registered_business (true/false)
- website_live (true/false)
- ownership_verified (true/false)
- activity_matches_description (true/false)

IF any = false:
  status = "REJECTED - LEGITIMACY FAILURE"
  STOP execution
  DO NOT calculate risk score

IF all = true:
  proceed to Stage 1 scoring

🟦 3. Input Schema (Structured Data)

merchant = {
  name: string,
  merchant_country: string,
  operating_country: string,

  customer_distribution: [
    { country: string, percentage: number }
  ],

  industry: string,
  product_type: "Physical" | "Digital" | "Subscription",
  refundability: "Easy" | "Moderate" | "Difficult",
  delivery_type: "Instant" | "Delayed",
  avg_order_value: number,

  business_model: "Direct" | "Marketplace" | "Aggregator" | "Dropshipping",
  seller_controls: "Strong" | "Moderate" | "Weak",
  payment_flow: "Merchant controls funds" | "Third-party controls funds",
  fulfilment: "Merchant fulfils" | "Shared responsibility" | "Third-party fulfils",

  processing_history: "No history" | "<6 months" | "6-12 months" | "1-3 years" | "3+ years",
  chargeback_rate: number,
  fraud_rate: number,
  refund_rate: number,

  business_maturity: "MVP" | "<1 year" | "1-3 years" | "3+ years"
}

🟦 4. Scoring Logic (CORE ENGINE)

4.1 Country Risk

country_score = predefined (1–5)

IF merchant_country != operating_country:
  add +0.5 risk adjustment (jurisdiction mismatch)

4.2 Customer Exposure (27%)

Take top 5 countries

weighted_score =
SUM(country_score × percentage)

IF >40% volume in high-risk countries (score ≥4):
  add +0.5

IF highly cross-border (>3 countries):
  add +0.3

4.3 Industry / Product (23%)

base_industry_score = predefined

Adjustments:
+0.5 if Digital
+0.5 if Subscription
+0.5 if refundability = Difficult
+0.3 if delivery = Instant
+0.3 if AOV is high

cap at 5

4.4 Business Model (14%)

base = 3

Adjustments:
+1 if Marketplace
+0.5 if Dropshipping
+0.5 if seller_controls = Weak
+0.5 if payment_flow = Third-party controls funds
+0.5 if fulfilment = Third-party fulfils

cap at 5

4.5 Historical Performance (8%)

IF no history:
  score = 3

ELSE:
  start at 3

  +1 if chargeback_rate high
  +1 if fraud_rate high
  +0.5 if refund_rate high

  -0.5 if strong history (>3 years clean)

clamp between 1–5

4.6 Business Maturity (10%)

MVP → 5
<1 year → 4
1–3 years → 3
3+ years → 2

🟦 5. Final Score Calculation

total_score =
(merchant_country × 0.18) +
(customer_exposure × 0.27) +
(industry_product × 0.23) +
(business_model × 0.14) +
(historical × 0.08) +
(business_maturity × 0.10)

🟦 6. Category Assignment (CRITICAL OUTPUT)

IF score <= 2.0 → "LOW"
IF score <= 3.0 → "MEDIUM"
IF score <= 4.0 → "ORANGE"
ELSE → "RED"

🟦 7. Monitoring Logic (MAIN BUSINESS OUTPUT)

LOW → 21 days
MEDIUM → 60 days
ORANGE → 90–120 days
RED → 120+ days + strict monitoring

🟦 8. Stage 2 — Monitoring Tracking

Track:

expected_risk = Stage 1 category

actual_metrics = {
  fraud_rate,
  chargebacks,
  refunds,
  geo_behavior
}

Compare:

IF actual ≈ expected → "ACCURATE"
IF actual < expected → "FALSE POSITIVE"
IF actual > expected → "UNDER-ESTIMATED RISK"

🟦 9. Stage 3 — Decision Engine

IF LOW or MEDIUM + accurate:
  decision = "STANDARD TERMS"

IF ORANGE:
  decision = "ADJUST TERMS or EXTEND"

IF RED or under-estimated:
  decision = "ESCALATE / RESTRICT"

🟦 10. Output Schema (FOR DASHBOARD)

This is what your dashboard will read:

output = {
  merchant_name,
  stage,

  legitimacy_status,

  scores: {
    merchant_country,
    customer_exposure,
    industry_product,
    business_model,
    historical,
    business_maturity
  },

  total_score,
  category,
  monitoring_days,

  stage2: {
    expected_risk,
    actual_outcome,
    variance
  },

  final_decision
}

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://surety-scan-flow.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c6aab1ee-16de-4249-8392-6b89f285bd7d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
