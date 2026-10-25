import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/errors';
import { param } from '../../lib/params';
import { PLAN_LIMITS, isWithinLimit } from '../../lib/plans';
import { prisma } from '../../lib/prisma';
import { generateOpaqueToken, hashToken } from '../../lib/tokens';
import { parse } from '../../lib/validate';
import { env } from '../../config/env';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { requireTenant } from '../../middleware/tenant';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const inviteSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});
const roleSchema = z.object({ role: z.enum(['ADMIN', 'MEMBER']) });
const acceptSchema = z.object({ token: z.string().min(10) });

/** Tenant-scoped team management. Requires `Authorization` and `X-Org-Id` headers. */
export const teamRouter = Router();
teamRouter.use(requireAuth, requireTenant);

teamRouter.get(
  '/members',
  asyncHandler(async (req, res) => {
    const members = await prisma.membership.findMany({
      where: { orgId: req.tenant!.orgId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ members: members.map((m) => ({ ...m.user, role: m.role, joinedAt: m.createdAt })) });
  }),
);

teamRouter.patch(
  '/members/:userId',
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const { role } = parse(roleSchema, req.body);
    const target = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: param(req, 'userId'), orgId: req.tenant!.orgId } },
    });
    if (!target) throw ApiError.notFound('Member not found');
    if (target.role === 'OWNER') throw ApiError.badRequest('The owner role cannot be changed');
    await prisma.membership.update({ where: { id: target.id }, data: { role } });
    res.status(204).end();
  }),
);

teamRouter.delete(
  '/members/:userId',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const target = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: param(req, 'userId'), orgId: req.tenant!.orgId } },
    });
    if (!target) throw ApiError.notFound('Member not found');
    if (target.role === 'OWNER') throw ApiError.badRequest('The owner cannot be removed');
    if (target.role === 'ADMIN' && req.tenant!.role !== 'OWNER') {
      throw ApiError.forbidden('Only the owner can remove an admin');
    }
    await prisma.membership.delete({ where: { id: target.id } });
    res.status(204).end();
  }),
);

teamRouter.get(
  '/invitations',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const invitations = await prisma.invitation.findMany({
      where: { orgId: req.tenant!.orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ invitations });
  }),
);

teamRouter.post(
  '/invitations',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { email, role } = parse(inviteSchema, req.body);
    const { orgId } = req.tenant!;

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { plan: true } });
    const [members, pending] = await Promise.all([
      prisma.membership.count({ where: { orgId } }),
      prisma.invitation.count({ where: { orgId, acceptedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    if (!isWithinLimit(PLAN_LIMITS[org.plan].members, members + pending)) {
      throw ApiError.paymentRequired('Member limit reached for your plan — upgrade to invite more people');
    }

    const existing = await prisma.membership.findFirst({ where: { orgId, user: { email } } });
    if (existing) throw ApiError.conflict('That user is already a member');

    const token = generateOpaqueToken();
    const invitation = await prisma.invitation.create({
      data: { orgId, email, role, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
      select: { id: true, email: true, role: true, expiresAt: true },
    });

    // TODO: send this link by email (Resend, Postmark, SES...). Returned to the inviter for now.
    const acceptUrl = `${env.WEB_URL}/accept-invite?token=${token}`;
    console.log(`[invite] ${email} → ${acceptUrl}`);
    res.status(201).json({ invitation, acceptUrl });
  }),
);

teamRouter.delete(
  '/invitations/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { count } = await prisma.invitation.deleteMany({
      where: { id: param(req, 'id'), orgId: req.tenant!.orgId },
    });
    if (!count) throw ApiError.notFound('Invitation not found');
    res.status(204).end();
  }),
);

/** Accepting an invite needs auth but no tenant (the user isn't a member yet). */
export const invitationsRouter = Router();

invitationsRouter.post(
  '/accept',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token } = parse(acceptSchema, req.body);
    const invitation = await prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw ApiError.badRequest('Invitation is invalid or has expired');
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
    if (user.email.toLowerCase() !== invitation.email) {
      throw ApiError.forbidden('This invitation was sent to a different email address');
    }
    await prisma.$transaction([
      prisma.membership.upsert({
        where: { userId_orgId: { userId: user.id, orgId: invitation.orgId } },
        create: { userId: user.id, orgId: invitation.orgId, role: invitation.role },
        update: {},
      }),
      prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    ]);
    res.json({ orgId: invitation.orgId });
  }),
);
