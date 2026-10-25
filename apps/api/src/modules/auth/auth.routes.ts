import bcrypt from 'bcryptjs';
import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env, isProd } from '../../config/env';
import { asyncHandler } from '../../lib/async-handler';
import { ApiError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { uniqueSlug } from '../../lib/slug';
import { generateOpaqueToken, hashToken, signAccessToken } from '../../lib/tokens';
import { parse } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';

const REFRESH_COOKIE = 'rt';
const REFRESH_PATH = '/api/auth';
const refreshTtlMs = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

const registerSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
  orgName: z.string().trim().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase()),
  password: z.string().min(1),
});

/** Creates a refresh token row, sets the httpOnly cookie, returns a fresh access token. */
async function issueSession(res: Response, userId: string): Promise<string> {
  const refreshToken = generateOpaqueToken();
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + refreshTtlMs) },
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: REFRESH_PATH,
    maxAge: refreshTtlMs,
  });
  return signAccessToken(userId);
}

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false });

export const authRouter = Router();

authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = parse(registerSchema, req.body);
    if (await prisma.user.findUnique({ where: { email: body.email } })) {
      throw ApiError.conflict('Email already registered');
    }
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email: body.email, name: body.name, passwordHash } });
      const orgName = body.orgName ?? `${body.name}'s workspace`;
      await tx.organization.create({
        data: {
          name: orgName,
          slug: uniqueSlug(orgName),
          memberships: { create: { userId: created.id, role: 'OWNER' } },
        },
      });
      return created;
    });
    const accessToken = await issueSession(res, user.id);
    res.status(201).json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const body = parse(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    // Same error for unknown email and wrong password to avoid user enumeration.
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw ApiError.unauthorized('Invalid email or password');
    }
    const accessToken = await issueSession(res, user.id);
    res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
  }),
);

/** Rotates the refresh token. Re-use of a revoked token revokes the whole token family. */
authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!raw) throw ApiError.unauthorized('No refresh token');

    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(raw) } });
    if (!stored) throw ApiError.unauthorized('Invalid refresh token');

    if (stored.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw ApiError.unauthorized('Refresh token reuse detected');
    }
    if (stored.expiresAt < new Date()) throw ApiError.unauthorized('Refresh token expired');

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const accessToken = await issueSession(res, stored.userId);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: stored.userId } });
    res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name } });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (raw) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(raw), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
    res.status(204).end();
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.userId! },
      select: { id: true, email: true, name: true },
    });
    res.json({ user });
  }),
);
