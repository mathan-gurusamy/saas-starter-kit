import type Stripe from 'stripe';
import { planFromSubscription } from '../../lib/plans';
import { prisma } from '../../lib/prisma';

/**
 * Mirrors a Stripe subscription onto the organization. Idempotent: it always
 * writes the full current state, so replayed or out-of-order webhooks are safe.
 */
export async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const orgId = sub.metadata?.orgId;

  const org = orgId
    ? await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } })
    : await prisma.organization.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
  if (!org) {
    console.warn(`[stripe] subscription ${sub.id} has no matching organization`);
    return;
  }

  const priceId = sub.items.data[0]?.price.id;
  const plan = planFromSubscription(sub.status, priceId);
  const ended = sub.status === 'canceled' || sub.status === 'incomplete_expired';

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      plan,
      stripeCustomerId: customerId,
      stripeSubscriptionId: ended ? null : sub.id,
      subscriptionStatus: sub.status,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
}
