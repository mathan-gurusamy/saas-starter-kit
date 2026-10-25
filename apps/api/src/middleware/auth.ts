import type { RequestHandler } from 'express';
import { ApiError } from '../lib/errors';
import { verifyAccessToken } from '../lib/tokens';

/** Verifies the Bearer access token and sets req.userId. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(ApiError.unauthorized('Missing access token'));
  try {
    req.userId = verifyAccessToken(header.slice(7)).sub;
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired access token'));
  }
};
