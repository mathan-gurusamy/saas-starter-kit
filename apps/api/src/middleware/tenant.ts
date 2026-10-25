import type { RequestHandler } from 'express';
import { ApiError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import type { RoleName } from '../lib/roles';

/**
 * Resolves the active tenant from the `X-Org-Id` header and verifies the
 * authenticated user is a member. Sets req.tenant = { orgId, role }.
 * Always filter tenant data by req.tenant.orgId.
 */
export const requireTenant: RequestHandler = async (req, _res, next) => {
  try {
    const orgId = req.header('x-org-id');
    if (!orgId) throw ApiError.badRequest('Missing X-Org-Id header');
    if (!req.userId) throw ApiError.unauthorized();

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: req.userId, orgId } },
      select: { role: true },
    });
    if (!membership) throw ApiError.forbidden('You are not a member of this organization');

    req.tenant = { orgId, role: membership.role as RoleName };
    next();
  } catch (err) {
    next(err);
  }
};
