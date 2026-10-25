import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/errors';
import { PLAN_LIMITS, priceIdForPlan } from '../../lib/plans';
import { prisma } from '../../lib/prisma';
import { getStripe } from '../../lib/stripe';
import { parse } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { requireTenant } from '../../middleware/tenant';
import { syncSubscription } from './billing.service';

const checkoutSchema = z.object({ plan: z.enum(['PRO', 'TEAM']) });

export const billingRouter = Router();
billingRouter.use(requireAuth, requireTenant);

/** Current plan, subscription state, limits and usage for the active org. */
billingRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { orgId } = req.tenant!;
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const [projects, members] = await Promise.all([
      prisma.project.count({ where: { orgId } }),
      prisma.membership.count({ where: { orgId } }),
    ]);
    res.json({
      plan: org.plan,
      status: org.subscriptionStatus,
      currentPeriodEnd: org.currentPeriodEnd,
      cancelAtPeriodEnd: org.cancelAtPeriodEnd,
      limits: PLAN_LIMITS[org.plan],
      usage: { projects, members },
    });
  }),
);

/** Starts a Stripe Checkout session for a paid plan. Owner only. */
billingRouter.post(
  '/checkout',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const { plan } = parse(checkoutSchema, req.body);
    const priceId = priceIdForPlan(plan);
    if (!priceId) throw new ApiError(503, `No Stripe price configured for the ${plan} plan`);

    const stripe = getStripe();
    const { orgId } = req.tenant!;
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    if (org.stripeSubscriptionId && org.plan !== 'FREE') {
      throw ApiError.conflict('This organization already has a subscription — use the billing portal to change it');
    }

    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
      const customer = await stripe.customers.create({
        email: user.email,
        name: org.name,
        metadata: { orgId },
      });
      customerId = customer.id;
      await prisma.organization.update({ where: { id: orgId }, data: { stripeCustomerId: customerId } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: orgId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { orgId } },
      allow_promotion_codes: true,
      success_url: `${env.WEB_URL}/billing?checkout=success`,
      cancel_url: `${env.WEB_URL}/billing?checkout=cancelled`,
    });
    res.json({ url: session.url });
  }),
);

/** Stripe Customer Portal: update card, change plan, cancel. Owner only. */
billingRouter.post(
  '/portal',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: req.tenant!.orgId } });
    if (!org.stripeCustomerId) throw ApiError.badRequest('No billing account yet — subscribe to a plan first');
    const session = await getStripe().billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${env.WEB_URL}/billing`,
    });
    res.json({ url: session.url });
  }),
);

/**
 * Stripe webhook. Mounted in app.ts with express.raw() BEFORE express.json(),
 * because signature verification needs the exact raw request body.
 */
export const stripeWebhookHandler = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.header('stripe-signature');
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) throw ApiError.badRequest('Webhook not configured');

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw ApiError.badRequest('Invalid webhook signature');
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode === 'subscription' && typeof session.subscription === 'string') {
        await syncSubscription(await stripe.subscriptions.retrieve(session.subscription));
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(event.data.object);
      break;
    default:
      break; // ignore everything else
  }
  res.json({ received: true });
});
