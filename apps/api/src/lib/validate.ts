import type { z } from 'zod';
import { ApiError } from './errors';

/** Parse untrusted input with a zod schema, throwing a 400 ApiError on failure. */
export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw ApiError.badRequest('Validation failed', result.error.flatten().fieldErrors);
  }
  return result.data;
}
