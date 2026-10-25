import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/errors';
import { param } from '../../lib/params';
import { PLAN_LIMITS, isWithinLimit } from '../../lib/plans';
import { prisma } from '../../lib/prisma';
import { parse } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { requireTenant } from '../../middleware/tenant';

const bodySchema = z.object({ name: z.string().trim().min(1).max(120) });

/**
 * Reference implementation of a tenant-scoped resource. Copy this module when
 * adding your own domain models:
 *   1. requireAuth + requireTenant on the router
 *   2. EVERY query filters by req.tenant.orgId (never trust an id from the client alone)
 *   3. requireRole() for privileged actions, plan limits for entitlements
 */
export const projectsRouter = Router();
projectsRouter.use(requireAuth, requireTenant);

projectsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const projects = await prisma.project.findMany({
      where: { orgId: req.tenant!.orgId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ projects });
  }),
);

projectsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name } = parse(bodySchema, req.body);
    const { orgId } = req.tenant!;

    const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { plan: true } });
    const count = await prisma.project.count({ where: { orgId } });
    if (!isWithinLimit(PLAN_LIMITS[org.plan].projects, count)) {
      throw ApiError.paymentRequired('Project limit reached for your plan — upgrade to create more');
    }

    const project = await prisma.project.create({ data: { orgId, name, createdBy: req.userId! } });
    res.status(201).json({ project });
  }),
);

projectsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { name } = parse(bodySchema, req.body);
    // updateMany with orgId in the filter makes cross-tenant writes impossible.
    const { count } = await prisma.project.updateMany({
      where: { id: param(req, 'id'), orgId: req.tenant!.orgId },
      data: { name },
    });
    if (!count) throw ApiError.notFound('Project not found');
    res.status(204).end();
  }),
);

projectsRouter.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { count } = await prisma.project.deleteMany({
      where: { id: param(req, 'id'), orgId: req.tenant!.orgId },
    });
    if (!count) throw ApiError.notFound('Project not found');
    res.status(204).end();
  }),
);
