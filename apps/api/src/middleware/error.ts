import type { ErrorRequestHandler, RequestHandler } from 'express';
import { isProd } from '../config/env';
import { ApiError } from '../lib/errors';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  console.error(err);
  res.status(500).json({ error: isProd ? 'Internal server error' : String(err?.message ?? err) });
};
