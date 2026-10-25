import { PrismaClient } from '@prisma/client';

// Single shared client. In dev, tsx watch re-evaluates modules, so cache on globalThis.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
