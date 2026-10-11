# Interview Pal

A private interview preparation workspace built with Next.js, TypeScript, Tailwind, Monaco, Supabase, and OpenAI voice interviews with Code Interpreter verification.

## What is implemented

- Dashboard with real progress, topic breakdowns, review items, and recent sessions.
- All 150 NeetCode catalog entries, searchable by topic, difficulty, and progress. Metadata comes from the [official NeetCode repository](https://github.com/neetcode-gh/leetcode); prompts and public examples are independently authored.
- Practice all 150 problems on LeetCode, with links, notes, progress, and optional saved drafts here. All 150 questions have authored interview briefs and examples with Python, JavaScript, and TypeScript editors. All 150 support LLM judgment of the editor code. The LLM selects Python cases for OpenAI Code Interpreter; JavaScript and TypeScript receive reasoning reviews without execution. There are no bundled problem test suites.
- Per-language code drafts, notes, attempts, progress, and separate review flags.
- STAR stories with reflections, competency tags, and links to multiple questions. Twenty original behavioral questions.
- Coding and behavioral interview rooms, timers, microphone preflight, live voice input/playback, typed responses, scratchpads, ordered transcripts, interrupted-session resume, and saved reviews.
- An OpenAI interviewer that answers clarification questions using the authored problem specification, recent conversation, current language/code, and supplied test results. Typed chat uses the Responses API; live voice uses Realtime WebRTC with automatic turn detection and interruptions. AI reviews contain evidence and descriptive evaluation dimensions.
- Responsive preparation/review pages, light/dark themes, invite-only email/password accounts, and workspace/transcript exports.
- Single-use invitations tied to email, verification and password recovery, and admin invitation/access management. Privileges bind to an explicitly designated Auth user ID.

Interview Pal does not store raw audio. Live voice sends audio directly to OpenAI over WebRTC; conversation context and review requests are also sent to OpenAI. AI answers and feedback can be incorrect; inspect the saved evidence.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Without Supabase variables, development on localhost provides a browser-local demo. Demo data survives reloads through localStorage. Interviews and Python verification require a server-side OpenAI API key. The localhost preview supports both; production requires private Supabase login. Production never enables the demo.

Monaco assets are copied from the installed dependency to `public/vendor/monaco` during install/build, so the editor does not depend on a CDN. The plain editor toggle offers an accessible textarea and works well on mobile.

## Configure Supabase and invite-only accounts

1. Keep **Allow new users to sign up** disabled during setup. Apply migrations 001–003 and the seed if they have not already been applied. Preserve current Auth accounts and workspace data.
2. Ensure your own verified email/password account already exists. For a fresh project, provision **zhangkw0622@gmail.com** in Authentication → Users before applying migration 004. A database reset creates no privileged user automatically; provision the designated account before migration 004 in that environment too.
3. Apply `supabase/migrations/202610100004_invite_only_users.sql`, followed by `supabase/migrations/202610110005_invitation_diagnostics.sql` and `supabase/migrations/202610110006_invitation_auth_rls.sql`. Existing accounts become ordinary members; invitation enforcement and active membership policies take effect. Then run `supabase/bootstrap-admin.sql` separately. It resolves **zhangkw0622@gmail.com** to exactly one verified, non-anonymous Auth user and grants that UUID admin access. It fails without granting access if the account is missing, unverified, or ambiguous. Admin access never comes from a first signup or profile fields. For a different installation, explicitly change the designated account in this setup file before running it.
4. In Authentication → Hooks, enable **Before User Created**, choose Postgres, and select `public.before_user_created`. The database signup trigger also enforces invitations if this hook is misconfigured. Hook checks do not consume codes; account creation and redemption commit together. See [Supabase Auth hooks](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook).
5. Configure [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) in Supabase for confirmation/recovery emails. The default mail service only sends to project team addresses. Set Supabase's Site URL and `AUTH_SITE_URL` to your actual website origin (for example, `http://127.0.0.1:3001` locally, HTTPS in production), and allow that origin's `/auth/confirm` redirect.
6. Replace the **Confirm signup** and **Reset password** email templates with `supabase/templates/confirmation.html` and `supabase/templates/recovery.html`. They send users to an explicit confirmation button, so a mail scanner's GET does not consume the token. Enable **Confirm email**, set minimum password length to **12**, retain Supabase Auth rate limits, and set the email resend interval to at least 60 seconds. No verification/recovery email should contain an invitation code.
7. After the migration, admin binding, hook, and email configuration are ready, enable email/password signup. Keep anonymous sign-ins, phone, and OAuth providers disabled. Registration is now gated by database invitation checks. Local settings and templates are in `supabase/config.toml`; hosted settings must be configured separately.
8. Copy `.env.example` to `.env.local` and fill these values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
AUTH_SITE_URL=http://127.0.0.1:3001
```

The second variable accepts a current `sb_publishable_…` key or a legacy `anon` key. Never put `sb_secret_…` or `service_role` credentials in a public variable. No service-role key is required. See [Supabase's key documentation](https://supabase.com/docs/guides/api/api-keys).

Restart Next.js after changing environment variables. Sign in at `/login`. The designated admin sees **Administration** in the sidebar. Create an invitation for a recipient email and copy the code immediately; only its hash is stored. Share it manually and direct the recipient to `/signup`. Codes expire after seven days and are consumed when the unverified account is created. Verification resends and password recovery need no new invitation. Replacing an unused invitation revokes the old one; existing accounts use verification resend/recovery instead of a second registration.

Admins can list account identity/access details and suspend or restore ordinary members. Admins cannot change roles in the website or read another user's drafts, stories, transcripts, or feedback. Suspension denies subsequent API and database access, including existing JWTs. Already-established provider voice connections are not forcibly terminated at the provider. The browser checks membership on focus and every 30 seconds and closes its room when access is lost. Logout and password recovery remain available to suspended accounts.

Personal tables retain owner-scoped RLS plus verified, active membership checks. Catalogs also require active membership. Workspace reads/writes (including unload beacons) and agent/admin requests bind to the user ID captured when the page loaded. Another tab signing in clears old state; stale requests cannot save into the new account. Cloud content never enters the localhost demo's browser storage. Story/link and session/event/feedback writes remain atomic, with visible save errors and retry for network failures.

To use the Supabase CLI, install it separately, link the intended project, and push unapplied migrations. Provision the designated account before migration 004 on a fresh database. Apply the separate bootstrap SQL explicitly, then configure the hosted Auth hook and email settings. Never enable signup first. If rollout fails, disable signup again and preserve membership/invitation tables and personal data while fixing configuration.

If signup fails even though an invitation is pending, apply only migration `202610110005_invitation_diagnostics.sql` to an existing installation using Supabase SQL Editor, then retry signup once and inspect **Auth service logs**. This migration changes only the hook's diagnostic error message; it preserves invitation enforcement, existing accounts, and pending codes. No Vercel redeploy is needed for the diagnostic. The error includes a fixed label such as `[invite:missing_code]`, `[invite:code_not_found]`, `[invite:email_mismatch]`, or `[invite:missing_provider]`. Share only that label when troubleshooting. Never log the hook payload or submit passwords/codes to support. A pending invitation confirms its stored status, not that the submitted code and email match it.

If valid pending codes report `code_not_found`, check whether `private.invitations` has RLS enabled without a SELECT policy for `supabase_auth_admin`. The hook is a security-invoker function, so a table grant alone is insufficient. Apply migration `202610110006_invitation_auth_rls.sql` to add the internal Auth read policy while keeping RLS enabled. This preserves existing codes and does not grant browser roles access. No application redeploy is needed for this database repair.

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

For a cloud workspace, apply `supabase/migrations/202610100002_interview_agent.sql` as well as the foundation migration. The agent endpoint requires private login and an owned, saved, active session. The only exception is development on localhost without Supabase, where a local demo can connect for testing. Responses requests use `store: false`. Operational logs include provider, session ID, action, status, and latency, never conversation text or credentials. Requests have bounded context, output tokens, and timeouts; server API requests are limited to 30/minute and 1,000/day per account. These quotas apply to connection/reply/review requests, not individual spoken turns within a connected Realtime call; configure your OpenAI project spending limits separately.

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
- `src/lib/problems/interview-questions.ts`: interview briefs and examples for all 150 problems, plus per-language starters and structural preludes.
- `src/lib/problems/starters.ts`: problem-specific function signatures, class APIs, and node definitions for the additional 135 interview questions. Existing drafts are kept; untouched legacy placeholders upgrade automatically.
- `src/lib/problems/definitions.ts`: the original 15 briefs and public examples, without fixed test suites.
- `src/lib/problems/function-starters.ts`: function and structural starters for those original briefs.
- `supabase/migrations`: profiles, role tracks, question collections, catalogs, drafts, progress, stories/links, sessions/events/feedback, attempts, and quota slots.

To customize interview behavior, edit the `instructions` function in the matching prompt file above. Each file also contains its own `opening`, `resume`, and `feedback` instructions. Keep the dynamic question/context fields intact. Typed responses use saved changes on the next request; start a new voice session to load changed instructions.

To connect another interviewer, implement `InterviewAgentAdapter` and supply its voice transport. The room uses the OpenAI adapter exclusively. The feedback format accepts agent-defined dimensions and evidence; the website does not impose a scoring rubric. Validate microphone permissions, playback, transcript ordering, disconnection/reconnection, and one complete spoken interview of each type with the real adapter before release.

Adding a role means seeding a role track and collections and registering its module. More interview questions can be added through briefs, examples, and starter contracts; LLM judging does not require a predefined test suite.

## Validation

```sh
npm run typecheck
npm test
npm run test:e2e
npm run test:auth
# Optional real-PostgreSQL race test; requires initdb, pg_ctl, and psql on PATH:
npm run test:invite-concurrency
npm run build
```

Regression tests validate all 450 starter declarations, LLM plan parsing, immutable candidate execution, genuine tool evidence, unordered outputs/multiplicity, stateful APIs, unavailable providers, timeouts, reasoning-only reviews, agent events, and workspace persistence. These tests protect the website and judge integration; they are not bundled coding-problem test suites. PostgreSQL policy tests run migrations/seed in PGlite, including catalog cleanup, anonymous and cross-account access, atomic writes, stale session updates, deletion behavior, and quotas.

Browser tests use installed Google Chrome via Playwright. They start a separate development server on port 3100 with cloud variables overridden empty. They cover preparation, stories, completed/interrupted sessions, saved reviews, unavailable execution, responsive navigation, themes, and API origin checks. Install Chrome or adjust `playwright.config.ts` to your browser. Test reports/traces and local credentials are ignored by Git.

`test:auth` builds and runs a separate production app on port 3102 with a test-only Supabase HTTP fixture on 54329. It exercises real SQL migrations/RLS in PGlite while substituting Auth password/verification delivery. It covers admin invites, verified signup, private draft persistence, suspension, recovery, stale cross-account saves/beacons, and expired links. No real accounts are created and no email is sent. Database tests also cover direct insertion bypasses, secret scrubbing, rollback, role escalation, and owner isolation. The concurrency script creates and removes its own temporary PostgreSQL cluster and races two independent connections against one invitation.

Before deployment, exercise one real invitation through confirmation email and one real password reset in your configured Supabase project. Fixture tests do not validate hosted SMTP delivery or dashboard hook configuration. Operational application logs omit passwords, invite codes, and Auth tokens; do not enable request-body logging on auth routes, and redact confirmation URL query strings in infrastructure logs.

Regression fixtures run locally; user Python code runs only in OpenAI Code Interpreter. Fixture tests do not establish live model/tool access; verify a real interview code check after configuring your API key.

## Deploy to Vercel

Import this repository as a Next.js project, use `npm run build`, and configure Supabase, OpenAI, and `AUTH_SITE_URL` in Vercel. Complete the invitation migration, explicit admin binding, Auth hook, SMTP, and confirmation/recovery templates before enabling email signup. Set Supabase’s Site URL to the same HTTPS origin. Keep alternative signup providers disabled.

Production requires Supabase and otherwise displays a setup page. Operational error logs contain classifications and session/job identifiers, not stories, source code, transcript text, or credentials. Reviews persist completed and interrupted sessions separately. The OpenAI adapter is implemented; manual spoken-session verification on your target browser is still required before release.

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
   | `NEXT_PUBLIC_SUPABASE_URL` | Existing project URL from `.env.local` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Existing publishable/anon key from `.env.local` |
   | `OPENAI_API_KEY` | Existing server-only API key from `.env.local` |
   | `OPENAI_INTERVIEW_MODEL` | Existing model value from `.env.local` |
   | `OPENAI_REALTIME_MODEL` | Existing model value from `.env.local` |

4. Deploy. Copy the stable production `.vercel.app` domain shown under the Interview Pal project's Settings → Domains. Visit `https://YOUR-APP.vercel.app/interview/login`; the app now lives under `/interview` even on this upstream domain. Keep Fluid Compute enabled: the interviewer route allows up to 210 seconds for code verification. The upstream production deployment must be reachable by the main website's rewrite; check deployment protection if it returns a Vercel authentication page.
5. In the **existing ZJN website project**, add `INTERVIEW_APP_ORIGIN=https://YOUR-APP.vercel.app` to Production environment variables. This value is the upstream origin only, with no `/interview` suffix. Copy `deployment/kwei-next.config.example.ts` from this repo into that website's `next.config.ts`, preserving any other settings. The current local ZJN config is empty. Commit/push the website config, or redeploy after setting the variable. These routing rules belong in ZJN, not Interview Pal. Use a plain `<a href="/interview">Interview practice</a>` for any homepage link across the two applications.
6. In Supabase Authentication → URL Configuration, set **Site URL** to `https://www.kwei.me/interview` and add **Redirect URL** `https://www.kwei.me/interview/auth/confirm`. Keep the confirmation and recovery templates from `supabase/templates`; they append `/auth/confirm` to Site URL. Account records, database migrations, passwords, and invitation codes do not need to be recreated. Once Site URL changes, these email templates send even local test requests to the deployed site; use a separate Supabase project when independent local email testing is needed.
7. Open `https://www.kwei.me/interview/login` and sign in with your existing account. Verify homepage access, saved drafts after reload, Monaco loading, invitations, password recovery, and a complete spoken interview before sharing the link. Check the URL stays under `/interview` after login, logout, and email confirmation.

`NEXT_PUBLIC_BASE_PATH` is a build-time setting: rebuild/redeploy after changing it. Leave it unset or empty in local `.env.local` to keep `http://127.0.0.1:3001` working as before. Native Next.js links handle the prefix; app fetches, browser redirects, public editor assets, auth email URLs, and auth cookie paths explicitly honor it. Origin checks accept the configured HTTPS public origin behind Vercel's rewrite without trusting arbitrary forwarded-host headers. Private workspace/admin responses remain uncached.

Run `TEST_BASE_PATH=/interview npm run test:auth` to exercise the production build, account flows, cookie scope, drafts, and editor assets under the prefix using the isolated Supabase fixture. `npm run test:auth` checks the original root deployment. The fixture does not test the live Vercel routing or hosted email delivery.
