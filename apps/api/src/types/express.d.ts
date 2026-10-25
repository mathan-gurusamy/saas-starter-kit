import type { RoleName } from '../lib/roles';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth */
      userId?: string;
      /** Set by requireTenant */
      tenant?: { orgId: string; role: RoleName };
    }
  }
}

export {};
