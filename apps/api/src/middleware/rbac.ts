import type { RequestHandler } from 'express';
import { ApiError } from '../lib/errors';
import { hasRole, type RoleName } from '../lib/roles';

/** Use after requireTenant. Allows callers whose role is >= `min`. */
export const requireRole =
  (min: RoleName): RequestHandler =>
  (req, _res, next) => {
    if (!req.tenant || !hasRole(req.tenant.role, min)) {
      return next(ApiError.forbidden(`Requires ${min} role or higher`));
    }
    next();
  };
