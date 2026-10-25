import type { Request } from 'express';
import { ApiError } from './errors';

/** Reads a required route param (safe under noUncheckedIndexedAccess). */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (!value) throw ApiError.badRequest(`Missing route param: ${name}`);
  return value;
}
