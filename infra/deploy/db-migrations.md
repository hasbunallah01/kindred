# Database migrations — Kindred

Production Postgres (Neon, per Blueprint Section 10) must be initialized
with the committed Prisma migration before either app can boot. A
fresh, empty database has no schema, so the agent runtime's first
Prisma call against `Community` (or any other model) fails with
"relation does not exist".

## What's committed

- `packages/db/migrations/migration_lock.toml` — declares the migration
  provider (`postgresql`).
- `packages/db/migrations/<timestamp>_init/migration.sql` — the
  initial migration, generated from the current
  `packages/db/schema.prisma` via
  `prisma migrate diff --from-empty --to-schema schema.prisma`. It
  contains:
  - all 11 tables (Better Auth's `user` / `session` / `account` /
    `verification` + the 7 Kindred domain models);
  - all 6 enums;
  - all foreign keys;
  - the hand-edited partial index on
    `RelationshipEvent.sentToMind` (`WHERE NOT "sentToMind"`), which
    Prisma's schema DSL can't represent declaratively — the schema's
    own comment on that field documents the same hand-edit step.

The migration is the **current** schema. It introduces no data, no
backfills, and no destructive changes — it's the only safe shape a
fresh database can land in.

## How to deploy to a fresh database

1. Ensure `DATABASE_URL` is set in the environment pointing at the
   target Postgres (Neon in production, the docker-compose service in
   dev).
2. From the repo root, run:

   ```bash
   npm run migrate:deploy -w @kindred/db
   ```

   This calls `prisma migrate deploy` (added as a workspace script in
   `packages/db/package.json`), which applies every committed
   migration in order and records the result in
   `_prisma_migrations`. It is idempotent: re-running against a
   database that's already at the latest migration is a no-op.

3. After the first successful deploy, `npm install` at the repo root
   (or the postinstall hook) will run `prisma generate` to refresh
   the typed client, which both `apps/web` and `apps/agent` import
   from `@kindred/db`.

## Day-to-day schema changes

For a brand-new change to the schema:

```bash
npm run migrate:dev -w @kindred/db -- --name <descriptive-name>
```

This generates a new migration under
`packages/db/migrations/<timestamp>_<name>/`, applies it to the
configured dev database, and regenerates the client. **Commit the
new migration directory** alongside the schema change so the next
production deploy picks it up via `migrate:deploy`.

## Why this is necessary

The audit flagged that `packages/db/migrations/` was empty on
`main`, so a fresh Neon project (or any wiped database) would
fail on the first Prisma call. The initial migration closes that
gap. No application code, schema, or other worker changed as part
of this fix — only the migration files, the `migrate:deploy`
script, and this doc.
