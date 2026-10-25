import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const signAccessToken = (userId: string): string =>
  jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });

export const verifyAccessToken = (token: string): { sub: string } =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };

/** Random opaque token handed to the client; only its SHA-256 hash is stored. */
export const generateOpaqueToken = (): string => crypto.randomBytes(32).toString('base64url');

export const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');
