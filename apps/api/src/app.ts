import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './modules/auth/auth.routes';
import { billingRouter, stripeWebhookHandler } from './modules/billing/billing.routes';
import { orgsRouter } from './modules/orgs/orgs.routes';
import { invitationsRouter, teamRouter } from './modules/orgs/team.routes';
import { projectsRouter } from './modules/projects/projects.routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // behind nginx / a platform load balancer
  app.use(helmet());
  app.use(cors({ origin: env.WEB_URL, credentials: true }));

  // Webhook must receive the raw body, so it is registered before express.json().
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/orgs', orgsRouter);
  app.use('/api/team', teamRouter);
  app.use('/api/invitations', invitationsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/billing', billingRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
