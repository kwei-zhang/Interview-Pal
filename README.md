# Interview Pal

A private interview preparation workspace built with Next.js, TypeScript, Tailwind, Monaco, Neon PostgreSQL with managed Better Auth, and OpenAI voice interviews with Code Interpreter verification.

## What is implemented

- Dashboard with real progress, topic breakdowns, review items, and recent sessions.
- All 150 [LeetCode Top Interview 150](https://leetcode.com/studyplan/top-interview-150/) questions in official study-plan order, searchable by 23 topics, difficulty, and progress. Catalog metadata was verified against the study plan on October 27, 2026; prompts and public examples are independently authored. Retired NeetCode questions remain accessible through existing links and saved sessions, without affecting current curriculum totals.
- Practice all 150 problems on LeetCode, with links, notes, progress, and optional saved drafts here. All 150 questions have authored interview briefs and examples with Python, JavaScript, and TypeScript editors. All 150 support LLM judgment of the editor code. The LLM selects Python cases for OpenAI Code Interpreter; JavaScript and TypeScript receive reasoning reviews without execution. There are no bundled problem test suites.
- Per-language code drafts, notes, attempts, progress, and separate review flags.
- STAR stories with reflections, competency tags, and links to multiple questions. Twenty original behavioral questions.
- Coding and behavioral interview rooms, timers, microphone preflight, live voice input/playback, typed responses, scratchpads, ordered transcripts, interrupted-session resume, and saved reviews.
- An OpenAI interviewer that answers clarification questions using the authored problem specification, recent conversation, current language/code, and supplied test results. Typed chat uses the Responses API; live voice uses Realtime WebRTC with automatic turn detection and interruptions. AI reviews contain evidence and descriptive evaluation dimensions.
- Responsive preparation/review pages, light/dark themes, invite-only email/password accounts, and workspace/transcript exports.
- Single-use invitations tied to email, verification and password recovery, and admin invitation/access management. Privileges bind to the stable application account UUID.

Interview Pal does not store raw audio. Live voice sends audio directly to OpenAI over WebRTC; conversation context and review requests are also sent to OpenAI. AI answers and feedback can be incorrect; inspect the saved evidence.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Without Neon variables, development on localhost provides a browser-local demo. Demo data survives reloads through localStorage. Interviews and Python verification require a server-side OpenAI API key. The localhost preview supports both; production requires private Neon login. Production never enables the demo.

Monaco assets are copied from the installed dependency to `public/vendor/monaco` during install/build, so the editor does not depend on a CDN. The plain editor toggle offers an accessible textarea and works well on mobile.

## Configure Neon and invite-only accounts

Use server-only `DATABASE_URL`, `NEON_AUTH_BASE_URL` and a cryptographically random `NEON_AUTH_COOKIE_SECRET` (at least 32 characters). Set `AUTH_SITE_URL` to the canonical HTTPS origin, with `/interview` when that base path is enabled. The runtime database credential must belong to `interview_runtime`, a login role that inherits only `interview_app`. The server rejects database-owner/superuser connections. No browser SQL client, Data API, service-role credential or catch-all authentication proxy is exposed.

Maintain the active database schema with `SCHEMA_DATABASE_URL` and `npm run db:apply`. See [Neon database maintenance](neon/README.md) for schema updates, catalog seeding and runtime-role requirements. Schema credentials are never deployed with the application.

The Top Interview 150 update includes `006_top_interview_150.sql`; apply it with `npm run db:apply` before using new questions in a connected workspace. It adds the new catalog and preserves existing progress, drafts, sessions, and retired problem IDs. `npm run seed:generate` refreshes the fresh-install seed without rewriting applied migrations.

In Neon Auth, enable email/password with **OTP email verification**, require verification, send a verification code on signup, and disable automatic sign-in after verification. Disable OAuth/anonymous/phone signups. Keep signup disabled until the signed `user.before_create` and `user.created` webhook at `/api/auth/neon-webhook` is reachable over HTTPS. Subscribe only to those two events so Neon retains its shared email delivery. Configure trusted website origins and test actual delivery/rate limits before production. See [Neon webhooks](https://neon.com/docs/auth/guides/webhooks).

Existing users choose **Reconnect existing account**, enter their original email and a new password, verify the emailed code, then sign in. Stable application UUIDs, roles and suspension status are preserved; a unique private mapping binds each application account to one verified Neon identity. Unverified, ambiguous or already-linked identities cannot reconnect an account. Admin privileges never come from signup fields or the first registration.

The admin creates an email-bound invitation in **Administration** and copies the code immediately; only its hash is stored. Share it manually and direct the recipient to `/signup`. The server exchanges a valid code for a short-lived admission token before calling Neon. The signed before-create hook approves the email admission without consuming the invitation. The created event or signup response binds the resulting provider identity. After account creation, finalization atomically creates membership and redeems the invitation. Signed created events and fresh authenticated sessions retry finalization safely. Revoked invitations cannot finalize. Verification resend and password recovery need no new invitation. An orphan provider account after revocation/partial failure requires administrator investigation; never bypass admission to repair it.

Admins may list account access details and suspend/restore ordinary members, but cannot read another user's drafts, stories, transcripts or feedback. Each API request checks a fresh provider session and current database membership. RLS requires transaction-local application identity, verified email and active membership. Suspension takes effect on subsequent requests. Already-established voice connections close when the browser checks membership (on focus/every 30 seconds); the provider connection is not forcibly revoked server-side.

Workspace mutations, beacons, agent and admin requests bind to the application UUID captured at page load. Another tab switching accounts clears old state; stale requests cannot save into the new account. Story/link and session/event/feedback saves remain atomic. Password-reset GETs only display the form; the token is consumed by explicit submission. Logout and password recovery are available even when an account is suspended.

## Interview code verification

Practice and submit code on LeetCode. During an interview, paste your solution into the editor and say “Please verify my code,” or explicitly state that your editor solution is finished. The interviewer can call the `verify_code` function in typed chat or live voice. The **Ask interviewer to judge** button sends that request too. The app cannot read an external LeetCode tab or synchronize LeetCode results.

The server uses [OpenAI Code Interpreter](https://developers.openai.com/api/docs/guides/tools-code-interpreter) through the Responses API with the configured `OPENAI_INTERVIEW_MODEL`. That model must support Code Interpreter. This uses the same API key and incurs OpenAI tool/container charges; no separate runner, Docker setup, or compiler credentials are needed.

- Python is the supported execution language. JavaScript and TypeScript remain available for editing and conceptual review, with a saved “AI review · not executed” assessment when judging is requested. No automatic translation is used.
- The candidate source is saved before execution, included unchanged in an uploaded test program, and checked by hash in the sandbox. Both the app's standalone function and LeetCode's `Solution` class format are supported. A fixed driver runs it in a subprocess with a five-second wall timeout, CPU/memory/output limits, and disabled container networking. The server requires actual Code Interpreter output from that exact driver; it does not accept an LLM's claim of passing tests.
- The LLM independently chooses cases and expected outputs from the original brief. Actual Python outputs are compared on the server against those AI-generated expectations. This is an AI assessment, not an authoritative judge or LeetCode acceptance; a mistaken expected value or runner can cause a misleading mismatch. The interviewer must validate a counterexample before revealing an answer and continue to obey the candidate-completion rule. Follow-up variants are assessed conversationally, separately from the original question.
- Attempts and their code snapshots survive provider failures. Old attempts remain available. Results for edited code are marked stale. Drafts over the 12,000-character agent context limit are not executed as partial programs.
- Uploaded files are deleted after each request and also have a one-hour expiry. Containers are deleted when their IDs are returned; an interrupted request may leave a container until OpenAI expires it. No raw code, output, or transcripts are written to operational logs.
- Cloud verification requires an owned active session and uses the existing execution quota (10/minute, 300/day) as well as the agent request quota. Local preview uses the agent request limit. A session interrupted by a lost request may retain a pending attempt; retry from the saved draft rather than treating it as a failed solution.

## Configure the real interviewer

Create an API key in your [OpenAI API project](https://platform.openai.com/api-keys) and enable API billing. Add these **server-only** values to `.env.local`:

```dotenv
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_INTERVIEW_MODEL=gpt-4.1-mini
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
```

The two model names can be changed to compatible models available to your API project. The Realtime default follows the [official WebRTC guide](https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime); access depends on your account. Restart the development server after changing environment variables. Never prefix the API key with `NEXT_PUBLIC_` or place it in browser code.

All interviews use OpenAI. Starting a new interview requires a configured API key; there is no scripted fallback. Older interrupted practice sessions automatically resume with OpenAI, keeping their transcript, timer, and code. Completed historical reviews remain available without being relabeled as AI evaluations. Entering or resuming a room connects live voice and opens your microphone automatically; allow microphone permission if your browser asks. The live interviewer greets you and introduces the selected question for a new session, without repeating it on resume. You can also type a question such as “Can the input be empty?” and send it. If voice cannot connect, typed chat stays available and **Speak** retries the connection. Spoken turns send automatically when you stop talking. **Mute mic** pauses microphone input; the audio control mutes playback. Leaving or finishing releases the microphone and connection. Reloading an interrupted session preserves its transcript and reconnects voice automatically.

The Neon migrations include persistent interview and execution quotas. The agent endpoint requires private login and an owned, saved, active session. The only exception is development on localhost without Neon, where a local demo can connect for testing. Responses requests use `store: false`. Operational logs include provider, session ID, action, status, and latency, never conversation text or credentials. Requests have bounded context, output tokens, and timeouts; server API requests are limited to 30/minute and 1,000/day per account. These quotas apply to connection/reply/review requests, not individual spoken turns within a connected Realtime call; configure your OpenAI project spending limits separately.

A provider failure leaves candidate turns and code saved. Retrying a failed typed turn avoids duplicating the candidate message. If feedback fails, the completed review explicitly says no assessment was generated. The interviewer receives public examples and verification outcomes, not preparation notes or the story bank. The judge receives the problem brief and unchanged candidate code and generates check cases at request time. Code context is capped at 12,000 characters and conversation context at 32,000; full drafts and transcripts remain in the workspace.

Verify actual microphone permission behavior, audio playback, interruptions, reconnection, transcript order, and complete coding and behavioral voice sessions on your target browser before release. Deterministic tests use provider fixtures and do not incur API charges.

## Database and integration boundaries

- `src/lib/interview/modules.ts`: `InterviewModule` registry; workspace capabilities, role, question selection, defaults, and feedback presentation.
- `src/lib/interview/agent.ts`: `InterviewAgentAdapter` session/input/event contract and voice transport boundary.
- `src/lib/interview/openai-agent.ts`: conversational adapter, retries, and AI review handling.
- `src/lib/interview/realtime-voice.ts`: WebRTC audio and data channel lifecycle.
- `src/lib/interview/realtime-events.ts`: ordered final transcripts and partial captions.
- `src/lib/server/prompts/leetcode.ts`: editable coding interview rules, hints, completion/answer-reveal behavior, variants, voice opening/resume, and feedback instructions.
- `src/lib/server/prompts/behavioral.ts`: editable BQ interview rules, story follow-ups, requested coaching, voice opening/resume, and feedback instructions.
- `src/lib/server/openai-interviewer.ts`: selects the prompt by session type and handles private OpenAI requests.
- `src/lib/interview/browser-voice.ts`: microphone checks, browser recognition and synthesis. Unsupported/denied voice input leaves typed responses available.
- `src/lib/server/code-verification.ts`: the interviewer verification tool, immutable Python execution driver, provider evidence validation, and cleanup.
- `src/lib/data/top-interview-150.json`: verified study-plan metadata; `src/lib/problems/top-interview-briefs.ts` adds the new problem briefs.
- `src/lib/problems/interview-questions.ts`: interview briefs and examples for all 150 problems, plus per-language starters and structural preludes.
- `src/lib/problems/starters.ts`: problem-specific function signatures, class APIs, and node definitions for the additional 135 interview questions. Existing drafts are kept; untouched legacy placeholders upgrade automatically.
- `src/lib/problems/definitions.ts`: the original 15 briefs and public examples, without fixed test suites.
- `src/lib/problems/function-starters.ts`: function and structural starters for those original briefs.
- `neon/migrations`: accounts, identity mappings, admission and webhook receipts, profiles, role tracks, question collections, catalogs, drafts, progress, stories/links, sessions/events/feedback, attempts, and quota slots.

To customize interview behavior, edit the `instructions` function in the matching prompt file above. Each file also contains its own `opening`, `resume`, and `feedback` instructions. Keep the dynamic question/context fields intact. Typed responses use saved changes on the next request; start a new voice session to load changed instructions.

To connect another interviewer, implement `InterviewAgentAdapter` and supply its voice transport. The room uses the OpenAI adapter exclusively. The feedback format accepts agent-defined dimensions and evidence; the website does not impose a scoring rubric. Validate microphone permissions, playback, transcript ordering, disconnection/reconnection, and one complete spoken interview of each type with the real adapter before release.

Adding a role means seeding a role track and collections and registering its module. More interview questions can be added through briefs, examples, and starter contracts; LLM judging does not require a predefined test suite.

## Validation

```sh
npm run typecheck
npm test
npm run test:e2e
npm run test:auth
# Real-PostgreSQL race test; requires initdb and pg_ctl:
npm run test:invite-concurrency
npm run build
```

Regression tests validate all 450 starter declarations, LLM plan parsing, immutable candidate execution, genuine tool evidence, unordered outputs/multiplicity, stateful APIs, unavailable providers, timeouts, reasoning-only reviews, agent events, and workspace persistence. These tests protect the website and judge integration; they are not bundled coding-problem test suites. PostgreSQL policy tests run migrations/seed in PGlite, including catalog cleanup, anonymous and cross-account access, atomic writes, stale session updates, deletion behavior, and quotas.

Browser tests use installed Google Chrome via Playwright. They start a separate development server on port 3100 with cloud variables overridden empty. They cover preparation, stories, completed/interrupted sessions, saved reviews, unavailable execution, responsive navigation, themes, and API origin checks. Install Chrome or adjust `playwright.config.ts` to your browser. Test reports/traces and local credentials are ignored by Git.

`test:auth` builds a production app on port 3102 with a test-only Neon Auth fixture on 54329 and isolated PostgreSQL 17 on 54328. It exercises the actual SDK, signed webhooks, SQL and RLS while substituting provider passwords and email delivery. Tests cover reconnecting an existing admin, suspended imports, invitation signup, codes, recovery, private drafts, stale saves/beacons, cookie scope and disallowed auth endpoints. No real email is sent. PostgreSQL binaries must be on PATH or configured with `PG_BIN`; Homebrew PostgreSQL 17 is detected on macOS. Fixtures stop their temporary cluster on graceful shutdown.

The concurrency script uses independent PostgreSQL connections to race invitation finalization and legacy account linking. Before authentication changes are released, verify real Neon signup/email delivery, account reconnection, password recovery including session revocation, saved workspace reloads and one complete interview. Fixture tests do not prove the hosted provider configuration. Operational logs must omit auth request bodies, credentials and reset query strings.

Regression fixtures run locally; user Python code runs only in OpenAI Code Interpreter. Fixture tests do not establish live model/tool access; verify a real interview code check after configuring your API key.

## Deploy to Vercel

Use the existing Next.js Vercel project and `npm run build`. Set the three server-only Neon variables, `AUTH_SITE_URL`, `NEXT_PUBLIC_BASE_PATH`, and retain the existing OpenAI environment. The production signed webhook is `https://www.kwei.me/interview/api/auth/neon-webhook`. Test changes in a preview with a separate Neon branch and its own reachable signed webhook before promoting the release. Keep deployment protection enabled.

Production requires Neon and otherwise displays setup instructions. Before database changes or rollback, preserve current Neon data and verify that the target application version supports the active schema.

### Serve Interview Pal at `https://www.kwei.me/interview`

`https://kwei.me` currently redirects to `https://www.kwei.me`, so use the canonical `www` origin for auth settings.

Use two Vercel projects: the existing `kwei-zhang/ZJN` website continues to own `kwei.me`; `kwei-zhang/Interview-Pal` serves the interview application. The website forwards only `/interview` and its nested paths to the app. Do not transfer the custom domain to the Interview Pal project.

1. Commit and push the latest Interview Pal source to `kwei-zhang/Interview-Pal`. Keep `.env.local` and `.next*` build directories out of Git.
2. In Vercel, choose **Add New → Project**, import `kwei-zhang/Interview-Pal`, select Next.js, and use Node.js 22.x with `npm run build` (leave the output directory at its framework default).
3. Set the app project's Production environment variables before deploying:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_BASE_PATH` | `/interview` |
   | `AUTH_SITE_URL` | `https://www.kwei.me/interview` |
   | `DATABASE_URL` | Restricted Neon runtime connection |
   | `NEON_AUTH_BASE_URL` | Managed Better Auth endpoint |
   | `NEON_AUTH_COOKIE_SECRET` | Random server-only secret |
   | `OPENAI_API_KEY` | Existing server-only API key from `.env.local` |
   | `OPENAI_INTERVIEW_MODEL` | Existing model value from `.env.local` |
   | `OPENAI_REALTIME_MODEL` | Existing model value from `.env.local` |

4. Deploy. Copy the stable production `.vercel.app` domain shown under the Interview Pal project's Settings → Domains. Visit `https://YOUR-APP.vercel.app/interview/login`; the app now lives under `/interview` even on this upstream domain. Keep Fluid Compute enabled: the interviewer route allows up to 210 seconds for code verification. The upstream production deployment must be reachable by the main website's rewrite; check deployment protection if it returns a Vercel authentication page.
5. In the **existing ZJN website project**, add `INTERVIEW_APP_ORIGIN=https://YOUR-APP.vercel.app` to Production environment variables. This value is the upstream origin only, with no `/interview` suffix. Copy `deployment/kwei-next.config.example.ts` from this repo into that website's `next.config.ts`, preserving any other settings. The current local ZJN config is empty. Commit/push the website config, or redeploy after setting the variable. These routing rules belong in ZJN, not Interview Pal. Use a plain `<a href="/interview">Interview practice</a>` for any homepage link across the two applications.
6. In Neon Auth, trust `https://www.kwei.me`, require verification codes, and configure the signed webhook at `https://www.kwei.me/interview/api/auth/neon-webhook`. Keep alternative providers disabled. Use a separate Neon branch/project for independent auth testing.
7. Reconnect your original account at `/interview/reconnect`. Confirm the imported admin role, workspace history, drafts saved after reload, Monaco assets, invitations, recovery and a complete interview. Promote the tested deployment only after those checks pass.

`NEXT_PUBLIC_BASE_PATH` is a build-time setting: rebuild/redeploy after changing it. Leave it unset or empty in local `.env.local` to keep `http://127.0.0.1:3001` working as before. Native Next.js links handle the prefix; app fetches, browser redirects, public editor assets, auth email URLs, and auth cookie paths explicitly honor it. Origin checks accept the configured HTTPS public origin behind Vercel's rewrite without trusting arbitrary forwarded-host headers. Private workspace/admin responses remain uncached.

Run `TEST_BASE_PATH=/interview npm run test:auth` to exercise the production build, account flows, cookie scope, drafts, and editor assets under the prefix using the isolated Neon fixture. `npm run test:auth` checks the original root deployment. The fixture does not test the live Vercel routing or hosted email delivery.
