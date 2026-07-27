// Shared Prisma Client singleton for Kindred.
//
// Both apps/web and apps/agent import { prisma } from '@kindred/db' rather
// than each instantiating their own client — one schema, one client, no
// drift between the two deployments (Blueprint Section 1.2).
//
// IMPORTANT — Prisma 7's custom generator output path: our generator block
// (schema.prisma) declares `output = "./generated/client"`. Per Prisma's own
// Better Auth integration guide, once a custom output path is configured you
// must import PrismaClient from that generated location, never from
// "@prisma/client". The exact generated entry-file path below
// (./generated/client/client) matches the documented pattern for this
// output setting, but this package's generated/ directory does not exist
// in this environment — `prisma generate` could not be run here (see the
// Checkpoint 5 commit). If the actual generated output uses a different
// entry filename, this import is the first thing to fix once you run
// `npm run generate` in this package on a machine with normal internet
// access.
import { PrismaClient } from './generated/client/client';

// Prevents Next.js's dev-mode hot-reloading from creating a new PrismaClient
// (and a new pool of database connections) on every module reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
