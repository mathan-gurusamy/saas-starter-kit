import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { prisma } from '../../lib/prisma';
import { uniqueSlug } from '../../lib/slug';
import { parse } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';

const createSchema = z.object({ name: z.string().trim().min(1).max(100) });

export const orgsRouter = Router();
orgsRouter.use(requireAuth);

/** Organizations the current user belongs to (used by the org switcher). */
orgsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.userId! },
      include: { org: { select: { id: true, name: true, slug: true, plan: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ orgs: memberships.map((m) => ({ ...m.org, role: m.role })) });
  }),
);

orgsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name } = parse(createSchema, req.body);
    const org = await prisma.organization.create({
      data: { name, slug: uniqueSlug(name), memberships: { create: { userId: req.userId!, role: 'OWNER' } } },
      select: { id: true, name: true, slug: true, plan: true },
    });
    res.status(201).json({ org: { ...org, role: 'OWNER' } });
  }),
);
