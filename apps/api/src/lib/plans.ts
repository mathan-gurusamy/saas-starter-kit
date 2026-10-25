import type { Plan } from '@prisma/client';
import { env } from '../config/env';

export interface PlanLimits {
  /** `null` means unlimited. */
  projects: number | null;
  members: number | null;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: { projects: 3, members: 2 },
  PRO: { projects: 25, members: 10 },
  TEAM: { projects: null, members: null },
};

export const PLAN_LABELS: Record<Plan, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  TEAM: 'Team',
};

export function isWithinLimit(limit: number | null, currentCount: number): boolean {
  return limit === null || currentCount < limit;
}

/** Stripe price id for a paid plan, or undefined if not configured. */
export function priceIdForPlan(plan: Exclude<Plan, 'FREE'>): string | undefined {
  const id = plan === 'PRO' ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_TEAM;
  return id || undefined;
}

export function planForPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_PRO) return 'PRO';
  if (priceId === env.STRIPE_PRICE_TEAM) return 'TEAM';
  return null;
}

/**
 * Decide which plan an org should be on given a Stripe subscription's status.
 * Dunning states (`past_due`) keep access while Stripe retries payment;
 * terminal states drop the org back to FREE.
 */
export function planFromSubscription(status: string, priceId: string | null | undefined): Plan {
  const paid = planForPriceId(priceId);
  if (!paid) return 'FREE';
  switch (status) {
    case 'active':
    case 'trialing':
    case 'past_due':
      return paid;
    default:
      return 'FREE';
  }
}
