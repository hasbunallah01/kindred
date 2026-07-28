// Shared Prisma Client singleton for Kindred.
//
// Both apps/web and apps/agent import { prisma } from '@kindred/db' rather
// than each instantiating their own client — one schema, one client, no
// drift between the two deployments (Blueprint Section 1.2).
//
// Import path: our generator block (schema.prisma) declares
// `output = "./generated/client"`, and PrismaClient is imported from that
// generated location (confirmed working — see below), never from
// "@prisma/client" directly (that package is still required as a runtime
// dependency, though — the generated client's internal files import
// shared runtime code from "@prisma/client/runtime/*". Confirmed root
// cause of a real Vercel build failure: that package was missing from
// this workspace's dependencies. Fixed by adding it to package.json.
import { PrismaClient } from './generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

// Prisma 7 removed the internal connection engine entirely: calling
// `new PrismaClient()` with no arguments now throws
// "PrismaClient needs to be constructed with a non-empty, valid
// PrismaClientOptions" at runtime. A driver adapter is required — no
// fallback exists. This wraps a standard `pg` connection pool in Prisma's
// official Postgres adapter and passes it explicitly.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: pg.Pool;
};

const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

const adapter = new PrismaPg(pool);

// Prevents Next.js's dev-mode hot-reloading from creating a new PrismaClient
// (and a new connection pool) on every module reload.
export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
