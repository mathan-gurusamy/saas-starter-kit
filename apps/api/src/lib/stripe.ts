import Stripe from 'stripe';
import { env } from '../config/env';
import { ApiError } from './errors';

let client: Stripe | undefined;

/** Lazily creates the Stripe client; billing routes return 503 until keys are configured. */
export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new ApiError(503, 'Billing is not configured (missing STRIPE_SECRET_KEY)');
  client ??= new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}
