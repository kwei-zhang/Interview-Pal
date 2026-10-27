# Supabase → Neon migration runbook

Keep the full Supabase database backup outside Git with file mode 0600. Do not use the app's JSON export: it does not include all account administration or older attempts. Keep the paused Supabase project intact.

## Inspect and import

Install locked dependencies with `npm ci`. PostgreSQL 17 binaries (`initdb`, `pg_ctl`) must be on PATH or `PG_BIN`; the Homebrew location is auto-detected. The inspection command creates an isolated socket-only cluster, imports application COPY rows, validates all foreign keys/checksums, checks rollback and repeat-import behavior, and stops/removes the cluster.

```sh
MIGRATION_REPORT_PATH=/private/path/dry-run.json npm run db:inspect-backup -- /private/path/full-backup.gz
```

The parser never executes SQL from the dump. It requires every expected table, rejects unknown application tables, validates account IDs and unique normalized emails, and imports identity metadata without passwords, tokens or provider sessions. Supabase infrastructure is excluded. The original backup remains the source of truth for recovery.

For Neon, supply the owner URL through the private environment variable `MIGRATION_DATABASE_URL` (not a command-line literal or checked-in file). Apply schema and dry-run import:

```sh
npm run db:migrate -- /private/path/full-backup.gz
# After reviewing the report and comparing it to the isolated run:
npm run db:migrate -- /private/path/full-backup.gz --apply
```

Schema migrations have an immutable checksum ledger. Imports preserve IDs/timestamps and use parameters, locks and a transaction. Dry runs roll back all imported rows. Retries accept only identical tables; nonempty conflicting tables abort the entire import. Once runtime writes or reconnections occur, a replay may correctly refuse because the target has changed. Never delete those writes to force an import. Identity sequences are advanced only on apply.

Create the restricted runtime login once, with `MIGRATION_DATABASE_URL` and `NEON_AUTH_BASE_URL` in the environment:

```sh
npm run db:runtime-role -- /private/path/runtime.env
```

The command refuses an existing login or destination file. It saves `DATABASE_URL` and an independently random cookie secret without printing them. Keep owner and runtime credentials separate; deploy only runtime credentials. On a genuinely fresh installation with no imported users, provision an explicit admin through a separately reviewed bootstrap procedure; no first-user promotion exists.

## Hosted Auth and rollout

1. Keep Neon signup disabled while provisioning. Disable the default shared Google provider and other alternative providers. Use email/password with OTP verification required, signup code delivery enabled, and auto-login after verification disabled. Shared email delivery remains enabled; do not subscribe to `send.otp`/`send.magic_link` unless replacing it.
2. Deploy the app with `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `AUTH_SITE_URL` and the existing base path. Never configure owner credentials on Vercel. Trust the canonical website origin in Neon.
   Preview password-reset emails return to the deployment's server-provided `VERCEL_URL`, preserving the base path. Add that exact HTTPS origin to Neon's trusted domains before testing recovery. This keeps reset tokens away from an older production authentication provider during migration. Production continues to use `AUTH_SITE_URL`.
3. Configure `user.before_create` + `user.created`, timeout 10 seconds, at the exact HTTPS webhook URL. The app verifies detached Ed25519 signatures against the configured provider JWKS, timestamp freshness, endpoint and event headers. Persisted receipts make duplicate delivery decisions stable; mismatched payloads are rejected.
4. The before-create event has no provider ID: admission is approved for the email, then bound by the signed created event or successful signup response. A lost callback/response can recover only through a fresh verified session with matching email and a provider creation timestamp inside the accepted admission window. Hosted signup drops additional JSON metadata fields; the server sends a fixed `InterviewPal-Admission/1` User-Agent with the short-lived, email-bound token, read only from the signed event's documented `event_data.user_agent`. Never forward the browser's User-Agent, log the token/header, or put invitation codes there. A masked HTTP 200 is not proof of creation: the signup endpoint requires a successfully admitted database binding. Test this against the hosted provider and verify that direct-provider bypass attempts create no users. Unreachable/invalid signed hooks must fail closed.
5. Reconnect the existing admin using the original email/new password/code. Check stable UUID and role, suspended accounts, saved history, invitation signup, actual email delivery, recovery/session revocation, saved workspace reloads and a complete interview. Run both browser suites at root and `/interview`.
6. Keep the stable `/interview` routing on the main website. Coordinate the production webhook URL and deployment promotion. Leave Supabase and backup untouched.

After Neon accepts new writes, rollback must first export Neon, preserve the identity mapping and account audit, and reconcile new/changed records with the destination. Old Supabase credentials/passwords cannot be reconstructed from Neon. Disable signup and pause application writes during reconciliation; never perform a blind restore over live data.
