# SaaS Starter Kit — Node.js + React + TypeScript

A production-oriented multi-tenant SaaS foundation: auth, organizations, role-based access, Stripe subscriptions with plan limits, Docker and CI.

| Layer    | Stack                                                          |
| -------- | -------------------------------------------------------------- |
| API      | Node 22, Express 4, TypeScript, Zod, Prisma 5, PostgreSQL 16   |
| Web      | React 18, Vite 5, React Router 6, TypeScript                   |
| Payments | Stripe Checkout + Customer Portal + webhooks                   |
| Ship     | Docker (multi-stage), docker-compose, GitHub Actions           |

## Quick start

```bash
cp .env.example .env            # set JWT_ACCESS_SECRET (>= 32 chars)
docker compose up -d db         # Postgres on :5432
npm install
npm run db:migrate -- --name init   # creates + applies the first migration (commit the generated folder)
npm run db:seed                 # optional: demo@example.com / password123
npm run dev                     # API :4000, web :5173 (proxies /api)
```

Full stack in containers: `docker compose --profile full up --build` → http://localhost:8080
(the API container runs `prisma migrate deploy` on start, so a committed migration must exist).

## What's included

- **Auth** — register/login, 15-minute JWT access token (kept in memory in the browser), rotating 30-day refresh token in an httpOnly cookie. Refresh tokens are stored hashed; re-use of a revoked token revokes the user's whole token set. bcrypt (cost 12), rate-limited auth routes, no user enumeration on login.
- **Multi-tenancy** — shared database, `orgId` on every tenant table. The client sends `X-Org-Id`; `requireTenant` verifies membership on every request and sets `req.tenant`. Users can belong to many organizations and switch between them.
- **RBAC** — `OWNER > ADMIN > MEMBER`. `requireRole('ADMIN')` guards routes; the UI hides what the role can't do (the server is the source of truth).
- **Team management** — invite by email (token link, 7-day expiry, hashed at rest), accept flow, change roles, remove members, revoke invites.
- **Billing** — Pro / Team plans via Stripe Checkout, Customer Portal for changes and cancellation, webhook-driven plan sync (idempotent), plan limits (`lib/plans.ts`) enforced server-side on projects and members (HTTP 402 → UI links to billing).
- **Reference resource** — `modules/projects` shows the tenant-scoped CRUD pattern to copy for your own models.
- **Ops** — Helmet, CORS locked to `WEB_URL`, env validation at boot, graceful shutdown, health check, non-root container, CI (typecheck, test, build, Docker build).

## Project layout

```
apps/api/prisma/schema.prisma      data model
apps/api/src/config/env.ts         validated environment
apps/api/src/middleware/           auth, tenant, rbac, error
apps/api/src/modules/              auth, orgs (+team), projects, billing
apps/api/src/lib/plans.ts          plan limits + Stripe price mapping
apps/web/src/lib/                  API client (auto-refresh), auth context
apps/web/src/pages/                Login, Register, Projects, Team, Billing, AcceptInvite
```

## Stripe setup

1. Create two recurring Prices (Pro, Team) in the Stripe dashboard; put their ids in `STRIPE_PRICE_PRO` / `STRIPE_PRICE_TEAM`.
2. Set `STRIPE_SECRET_KEY`.
3. Locally: `stripe listen --forward-to localhost:4000/api/webhooks/stripe` and copy the printed signing secret to `STRIPE_WEBHOOK_SECRET`.
4. In production add a webhook endpoint for `checkout.session.completed` and `customer.subscription.created|updated|deleted`.
5. Enable the Customer Portal in Stripe settings.

Plan limits live in `apps/api/src/lib/plans.ts` — edit them to match your pricing.

## Adding your own tenant-scoped model

1. Add the model to `schema.prisma` with an `orgId` column + relation to `Organization` + `@@index([orgId])`.
2. Copy `modules/projects/projects.routes.ts`. Keep `requireAuth, requireTenant` on the router and put `orgId: req.tenant!.orgId` in **every** `where`.
3. Mount the router in `app.ts`.

## Before you ship (checklist)

- [ ] Generate and commit the initial Prisma migration (`npm run db:migrate -- --name init`) and `package-lock.json` (CI and the Dockerfiles use `npm ci` when a lockfile exists).
- [ ] Send invitation emails (see the TODO in `modules/orgs/team.routes.ts`); add password reset and email verification.
- [ ] Add integration tests against a real Postgres (CI already has `npm test`; only a role unit test exists today).
- [ ] Set a strong `JWT_ACCESS_SECRET`; serve over HTTPS (the refresh cookie is `secure` in production).
- [ ] Pick your own deploy target and enable the commented `deploy` job in `.github/workflows/ci.yml`.

## Status of this scaffold

Written and reviewed by hand but **not yet compiled or run** — the environment it was generated in could not reach the npm registry. First run: `npm install && npm run typecheck && npm test`, fix anything the compiler flags, then do the quick-start flow end to end.
