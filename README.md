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
- Responsive preparation/review pages, light/dark themes, private email/password login, and workspace/transcript exports.

Interview Pal does not store raw audio. Live voice sends audio directly to OpenAI over WebRTC; conversation context and review requests are also sent to OpenAI. AI answers and feedback can be incorrect; inspect the saved evidence.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Without Supabase variables, development on localhost provides a browser-local demo. Demo data survives reloads through localStorage. Interviews and Python verification require a server-side OpenAI API key. The localhost preview supports both; production requires private Supabase login. Production never enables the demo.

Monaco assets are copied from the installed dependency to `public/vendor/monaco` during install/build, so the editor does not depend on a CDN. The plain editor toggle offers an accessible textarea and works well on mobile.

## Configure Supabase and your private account

1. Create a Supabase project. In its SQL Editor run the three files in `supabase/migrations` in filename order, then `supabase/seed.sql`. For an existing project, apply `202610100003_llm_judging.sql` to retire catalog test suites while preserving personal work. Each migration runs once; the seed can be rerun to update catalogs.
2. In Authentication settings, disable **Allow new users to sign up**. The local Supabase configuration already has `enable_signup = false`; a hosted project must be configured separately.
3. In Authentication → Users, create your own user with an email and password and mark the email confirmed. The app intentionally has no signup page.
4. Copy `.env.example` to `.env.local` and fill these values from your project's **Connect** dialog:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

The second variable accepts a current `sb_publishable_…` key or a legacy `anon` key. Never put `sb_secret_…` or `service_role` credentials in a public variable. No service-role key is required. See [Supabase's key documentation](https://supabase.com/docs/guides/api/api-keys).

Restart the Next.js server after changing environment variables. Sign in at `/login`. Personal tables have owner-scoped row-level security; anonymous accounts cannot access them. Catalogs are readable by authenticated users. Story/link and session/event/feedback writes use atomic database functions. Workspace updates are optimistic, with visible save errors and retry; pending changes use a best-effort unload beacon.

To use the Supabase CLI instead of the SQL Editor, install the CLI separately, link your project, push migrations, and apply `supabase/seed.sql`. Review CLI target/project selection before changing a remote database.

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
npm run build
```

Regression tests validate all 450 starter declarations, LLM plan parsing, immutable candidate execution, genuine tool evidence, unordered outputs/multiplicity, stateful APIs, unavailable providers, timeouts, reasoning-only reviews, agent events, and workspace persistence. These tests protect the website and judge integration; they are not bundled coding-problem test suites. PostgreSQL policy tests run migrations/seed in PGlite, including catalog cleanup, anonymous and cross-account access, atomic writes, stale session updates, deletion behavior, and quotas.

Browser tests use installed Google Chrome via Playwright. They start a separate development server on port 3100 with cloud variables overridden empty. They cover preparation, stories, completed/interrupted sessions, saved reviews, unavailable execution, responsive navigation, themes, and API origin checks. Install Chrome or adjust `playwright.config.ts` to your browser. Test reports/traces and local credentials are ignored by Git.

Regression fixtures run locally; user Python code runs only in OpenAI Code Interpreter. Fixture tests do not establish live model/tool access; verify a real interview code check after configuring your API key.

## Deploy to Vercel

Import this repository as a Next.js project, use `npm run build`, and configure the Supabase and OpenAI environment variables in Vercel. Apply database migration/seed and provision your user before launch. Set Supabase's site URL to your deployment's HTTPS origin. Login uses passwords and has no OAuth callback route.

Production requires Supabase and otherwise displays a setup page. Operational error logs contain classifications and session/job identifiers, not stories, source code, transcript text, or credentials. Reviews persist completed and interrupted sessions separately. The OpenAI adapter is implemented; manual spoken-session verification on your target browser is still required before release.
