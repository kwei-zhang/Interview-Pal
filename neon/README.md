# Neon database maintenance

The application uses Neon PostgreSQL and managed Better Auth. `migrations/` contains the active application schema, ownership policies, atomic save functions, admission checks, signed-webhook receipts and catalog updates. `seed.sql` contains the current catalog, problem definitions and behavioral questions.

## Schema updates

Use a database-owner connection through `SCHEMA_DATABASE_URL` in a private local environment. Never deploy this credential as the application's `DATABASE_URL`.

```sh
npm run db:apply
```

The command applies unapplied SQL files in filename order, in one transaction with an advisory lock. The checksum ledger rejects modifications to previously applied files. Add a new numbered SQL file for subsequent database changes. The historical numbering gap is intentional; do not renumber existing files.

`db:apply` only maintains schema and catalog updates. It accepts no backup paths or import flags. Applying it again leaves already-applied files unchanged. Existing live data and the schema ledger remain in Neon.

## Catalog data

```sh
npm run seed:generate
```

This regenerates `neon/seed.sql` from the current source catalogs. Fresh databases and local database tests load this seed after the schema. Add a numbered SQL update when changing the catalog of an existing deployment; do not rewrite an applied file. Catalog updates preserve existing drafts, notes, attempts and retired problem IDs.

## Runtime access

The server uses a separate `interview_runtime` login with only `interview_app` membership. It must have no superuser, database-creation, role-creation, replication or row-security bypass privileges, and must not own the application tables. The production role is already provisioned. A new database needs this restricted login configured separately before deploying the app.

Set server-only `DATABASE_URL`, `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET` in Vercel. Set `AUTH_SITE_URL=https://www.kwei.me/interview` and `NEXT_PUBLIC_BASE_PATH=/interview`. Keep schema administration credentials off Vercel.

The live signed authentication webhook is `https://www.kwei.me/interview/api/auth/neon-webhook`. Use a separate Neon branch for independent provider testing. Preview recovery redirects use the exact server-provided preview origin, which must be trusted in that branch's Auth configuration.

## Local verification

```sh
npm test
npm run test:invite-concurrency
npm run test:auth
TEST_BASE_PATH=/interview npm run test:auth
```

These tests create isolated databases and provider fixtures. They do not modify production accounts or send real email. Reconnection remains available for imported application accounts that have not yet linked their verified Neon identity; this is part of the live authentication flow.
