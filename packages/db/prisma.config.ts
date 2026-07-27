import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 configuration for the shared Kindred schema.
// Connection URLs and file locations are configured here rather than
// in schema.prisma (a Prisma 7 change — see schema.prisma's header comment).
export default defineConfig({
  schema: 'schema.prisma',
  migrations: {
    path: 'migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
