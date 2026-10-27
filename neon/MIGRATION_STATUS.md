# Migration validation record — 2026-10-27

Status: switched to Neon in production on 2026-10-27 at the user's request. The live application remains at [kwei.me/interview](https://www.kwei.me/interview). Production deployment `dpl_AGJiQcBvFoGzpx99TJ7rjnEYW1NG` was built with production environment variables, checked before promotion, and promoted successfully.

## Infrastructure

The user-created Interview-Pal Neon Free project was reused: AWS us-east-2 (Ohio), PostgreSQL 18, automatic scale-to-zero retained. This differs from the proposed fresh PostgreSQL 17 / us-east-1 defaults. Backup inspection and concurrency tests also passed on isolated PostgreSQL 17.7.

Supabase remains paused and intact. The full October 24 backup is outside Git; a protected working copy and detailed dry-run/import reports are in the private migration directory. Production and preview use the restricted runtime login; migration-owner credentials are not deployed. The main website's existing external rewrite and `/interview` base path were retained.

## Imported data

All 21 table counts and normalized database checksums matched the isolated import and Neon dry run. Foreign keys passed, no duplicate normalized emails were found, dry-run changes rolled back, and an identical import retry succeeded. IDs and timestamps were preserved.

| Table | Rows | SHA-256 |
| --- | ---: | --- |
| public.role_tracks | 1 | a48e5add85c61fd1ae4b365f3237fbe26429e9d858a2bb9473d19f3637647fad |
| public.question_collections | 1 | db288378010db65d96821354baa825495fcae86d44877b5088b0f80a2bbf5d33 |
| public.problems | 150 | 72d4cc991210e29df67e35565f274e1dc302c6385789fb53348ac3d91b8be55a |
| public.problem_definitions | 15 | 242aa8d49d144f8afc0404f2dd038a4c183d67ab0415f9ee8a3aded0d248b80f |
| public.behavioral_questions | 20 | 91c608655d2034542feac2a0eadeffc7d5ad8e541623c2a90c478ef4a99249b9 |
| public.app_accounts | 2 | 004f04f7542cb38090e5a8d818ff103016a305a990629515a2ef45d615e921ef |
| public.profiles | 1 | 0953bc58600c0456359bb1a826c23b4570b8c4a14fe232c23d84100fd6bc2da3 |
| public.problem_progress | 3 | 3c01e19c110cf830cba8b2f75846dd4ed14d78bbf26821ccf763b01d0aa96bd5 |
| public.code_drafts | 0 | 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945 |
| public.stories | 0 | 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945 |
| public.story_question_links | 0 | 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945 |
| public.interview_sessions | 1 | 30621e178a4ca1c428290a41ce7846f2c4eaab86f9337068f455f907b30a630c |
| public.interview_events | 3 | 6f3798827e75c63303f0708c5a39ceb8045dec3c98d976744f347b1807c341da |
| public.session_feedback | 1 | 4353f136270a944a978cd3753004d7250cd2ab5b8f01b4ce6bf311ba964c2852 |
| public.attempts | 0 | 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945 |
| public.execution_slots | 0 | 4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945 |
| public.agent_request_slots | 2 | 07649797fe804dac8d8c6f3ece9cf997ae468d2b2b697003dbf461a226d4b291 |
| private.invitations | 3 | 8f512b02cfe72f6c83ce9beab0067a818721e1cd0ec6e5b000a7c3c64b69e84b |
| private.access_audit | 8 | 308f55831e9372b7b48962e20ef157047977dd3eb00b87744c9b4a1568063fd4 |
| private.legacy_auth_users | 2 | c6e9e72c22f9279a7178427872ac18368b97b81498a24ad94a3ec086ef149d92 |
| private.legacy_auth_identities | 2 | 418434c77403d208c1c96599daf50f2a11ed2f30d9943d7039a7e3ece6d4c78e |

The backup contains zero drafts, stories, story links and execution attempts. Those empty tables were checked explicitly; the migration does not infer records from comments or later COPY sections. Two application accounts, including one admin, were imported. Provider passwords/sessions were excluded; legacy identity metadata was retained separately.

## Checks

- Locked install and npm audit: zero known vulnerabilities after the Next.js security patch.
- Typecheck: passed.
- Unit/database suite: 72 passed before the final recovery redirect regression; all 8 targeted auth tests passed after that change.
- PostgreSQL invitation/linking concurrency: passed.
- Workspace browser suite: 22 passed at root and 22 at /interview.
- Authentication browser suite: 8 passed at root and 8 at /interview.
- Live signed before-create rejection and request-metadata admission transport: verified; rejected probes created no provider users or identity mappings.
- Preview HTTP checks: unsigned webhook 401, unauthenticated workspace 401, disallowed auth proxy 404, reset form no-store/no-referrer headers.
- Shared Neon email delivery and real emailed-code verification: passed.
- Existing admin reconnected with real email verification and login: original UUID, admin role, active status and imported interview preserved. Saved workspace and imported transcript/feedback were checked in the preview.
- Production HTTP checks: login and reconnect pages 200; reset form 200 with no-store/no-referrer; unauthenticated workspace and unsigned webhook 401; disallowed auth proxy 404.
- Production password-recovery request returned 200. The new email arrived in the admin's inbox at 06:10:59 UTC and its destination was verified as `https://www.kwei.me/interview/reset-password` without consuming the token.
- Actual password-reset completion/session revocation and a complete live interview remain unverified. The user requested the production switch before these remaining manual checks. An unfinished validation interview is preserved in Neon.

The signed Neon webhook now points to `https://www.kwei.me/interview/api/auth/neon-webhook`; the preview automation bypass was removed from its URL and the saved configuration was verified. Preview email recovery still uses each deployment's trusted preview origin. After any new Neon writes, preserve and reconcile them before rollback. The old Supabase deployment must not be restored over live Neon data without that reconciliation.
