import { PrismaClient } from '@prisma/client';

/**
 * Global Prisma instance to prevent multiple connections during Hot Module Replacement (HMR)
 * in development environments.
 */
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
