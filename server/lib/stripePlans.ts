/**
 * AgenThinkMesh Stripe Plan Configuration
 * Products and prices created via scripts/create-stripe-products.mjs
 */

export type PlanName = 'starter' | 'professional' | 'enterprise';

export interface PlanConfig {
  name: PlanName;
  displayName: string;
  priceId: string | null;
  monthlyUsd: number;
  tokensPerMonth: number;
  description: string;
  features: string[];
}

export const STRIPE_PLANS: Record<PlanName, PlanConfig> = {
  starter: {
    name: 'starter',
    displayName: 'Starter',
    priceId: null, // Free — no Stripe price
    monthlyUsd: 0,
    tokensPerMonth: 50, // 50 lifetime trial runs (not monthly)
    description: 'Free trial — 50 Council runs, no credit card required.',
    features: [
      '50 Council runs (lifetime trial)',
      'All 10 Council personas',
      'Basic verdict report',
      'Community support',
    ],
  },
  professional: {
    name: 'professional',
    displayName: 'Professional',
    priceId: 'price_1TGEPJAa3RimrPnI9l1nWfSV',
    monthlyUsd: 49,
    tokensPerMonth: 5000,
    description: '$49/month — 5,000 tokens, full Council access.',
    features: [
      '5,000 tokens per month',
      'All 10 Council personas',
      'Full PDF Council report',
      'Memory-augmented voting (past decisions)',
      'Priority email support',
      'Stripe invoice for each session',
    ],
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    priceId: 'price_1TGEPKAa3RimrPnI5f4B1xlO',
    monthlyUsd: 199,
    tokensPerMonth: 25000,
    description: '$199/month — 25,000 tokens, dedicated support.',
    features: [
      '25,000 tokens per month',
      'All 10 Council personas',
      'Full PDF Council report',
      'Memory-augmented voting (past decisions)',
      'Self-Learning Loop access',
      'Dedicated account manager',
      'Custom integration support',
      'SLA guarantee',
    ],
  },
};

/** Tokens consumed per full 10-persona Council run */
export const TOKENS_PER_COUNCIL_RUN = 10;

/** Tokens consumed per single agent call */
export const TOKENS_PER_AGENT_CALL = 1;

/** Get plan config by Stripe price ID */
export function getPlanByPriceId(priceId: string): PlanConfig | null {
  return (
    Object.values(STRIPE_PLANS).find((p) => p.priceId === priceId) ?? null
  );
}

/** Get plan config by plan name */
export function getPlanByName(name: PlanName): PlanConfig {
  return STRIPE_PLANS[name];
}
