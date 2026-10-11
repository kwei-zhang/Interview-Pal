import { test } from "node:test";
import assert from "node:assert/strict";
import { signupSchema } from "../src/lib/auth";
import { createAccountFetch } from "../src/lib/account-client";
import { assertAccountBinding } from "../src/lib/server/supabase";
import { authFailure, authSiteUrl } from "../src/lib/server/auth";
import { assertSameOrigin, HttpError } from "../src/lib/server/http";
import { appPath } from "../src/lib/paths";

test("Registration normalizes email and codes, enforces passwords, and rejects privilege fields", () => {
  const input = {email: "  INVITEE@example.com  ", displayName: " Candidate ", password: "Strong password 2026", inviteCode: "abcdef01-abcdef01-abcdef01-abcdef01"};
  const parsed = signupSchema.parse(input);
  assert.equal(parsed.email, "invitee@example.com"); assert.equal(parsed.displayName, "Candidate");
  assert.equal(parsed.inviteCode, "ABCDEF01ABCDEF01ABCDEF01ABCDEF01");
  assert.equal(signupSchema.safeParse({...input, password: "short"}).success, false);
  assert.equal(signupSchema.safeParse({...input, role: "admin"}).success, false);
});
test("Missing and mismatched workspace owners reject saves, including beacon envelopes", () => {
  assertAccountBinding("owner", "owner");
  assert.throws(() => assertAccountBinding("old-owner", "new-owner"), /account changed/);
  assert.throws(() => assertAccountBinding(undefined, "owner"), /account changed/);
});
test("Client captures its account and invalidates on auth failures, but not ordinary conflicts", async () => {
  let lost = 0;
  const accountFetch = createAccountFetch("original-owner", () => {lost++;}, async (_url, init) => {
    assert.equal(new Headers(init?.headers).get("x-workspace-user-id"), "original-owner");
    return Response.json({code: "account_changed"}, {status: 409});
  });
  await accountFetch("/api/workspace", {headers: {"x-workspace-user-id": "another-owner"}});
  assert.equal(lost, 1);
  await createAccountFetch("original-owner", () => {lost++;}, async () => Response.json({error: "Session ended"}, {status: 409}))("/api/interview-agent");
  assert.equal(lost, 1);
});
test("Auth email redirects require a configured production origin", () => {
  const previous = process.env.AUTH_SITE_URL;
  try {
    process.env.AUTH_SITE_URL = "https://interview.example";
    assert.equal(authSiteUrl(new Request("https://attacker.example/api/auth/signup")), "https://interview.example");
    process.env.AUTH_SITE_URL = "http://attacker.example";
    assert.throws(() => authSiteUrl(new Request("https://interview.example")), /HTTPS AUTH_SITE_URL/);
  } finally {if (previous === undefined) delete process.env.AUTH_SITE_URL; else process.env.AUTH_SITE_URL = previous;}
});

test("Subpath URLs preserve root deployments and do not double-prefix requests", () => {
  assert.equal(appPath("/", "/interview"), "/interview");
  assert.equal(appPath("/api/workspace", "/interview"), "/interview/api/workspace");
  assert.equal(appPath("/login?notice=account-changed", "/interview"), "/interview/login?notice=account-changed");
  assert.equal(appPath("/interview/api/workspace", "/interview"), "/interview/api/workspace");
  assert.equal(appPath("/interviews", "/interview"), "/interview/interviews");
  assert.equal(appPath("/login", ""), "/login");
  assert.equal(appPath("https://external.example", "/interview"), "https://external.example");
});

test("Proxied mutations accept the configured public origin but reject forged forwarding headers", () => {
  const previous = process.env.AUTH_SITE_URL;
  try {
    process.env.AUTH_SITE_URL = "https://kwei.me/interview";
    assert.doesNotThrow(() => assertSameOrigin(new Request("https://upstream.vercel.app/interview/api/auth/login", {headers: {origin: "https://kwei.me", host: "upstream.vercel.app"}})));
    for (const origin of ["https://evil.example", "https://kwei.me.evil.example", "http://kwei.me", "null"]) {
      assert.throws(() => assertSameOrigin(new Request("https://upstream.vercel.app/interview/api/auth/login", {headers: {origin, host: "upstream.vercel.app", "x-forwarded-host": new URL(origin === "null" ? "https://evil.example" : origin).host}})), /must come from/);
    }
    assert.throws(() => assertSameOrigin(new Request("https://upstream.vercel.app/interview/api/auth/login")), /must come from/);
  } finally {if (previous === undefined) delete process.env.AUTH_SITE_URL; else process.env.AUTH_SITE_URL = previous;}
});

test("Signup errors distinguish email setup, password requirements, and throttling without exposing provider details", t => {
  const logged: string[] = [];
  t.mock.method(console, "warn", (value: string) => logged.push(value));
  assert.throws(() => authFailure({status: 400, code: "email_address_not_authorized"}, "Fallback", "signup"),
    (error: unknown) => error instanceof HttpError && error.status === 503 && error.code === "email_address_not_authorized" && error.message.includes("custom SMTP"));
  assert.throws(() => authFailure({status: 422, code: "weak_password"}, "Fallback", "signup"),
    (error: unknown) => error instanceof HttpError && error.status === 400 && error.message.includes("password requirements"));
  assert.throws(() => authFailure({status: 429, code: "over_email_send_rate_limit"}, "Fallback", "signup"),
    (error: unknown) => error instanceof HttpError && error.status === 429 && error.message.includes("account emails"));
  const providerError = {status: 400, code: "private@example.test", message: "secret password and invitation code"};
  assert.throws(() => authFailure(providerError, "Safe fallback", "signup"),
    (error: unknown) => error instanceof HttpError && error.message === "Safe fallback" && error.code === "auth_request_rejected");
  assert.equal(logged.length, 4);
  assert.equal(JSON.parse(logged[0]).code, "email_address_not_authorized");
  assert.equal(JSON.parse(logged[3]).code, "unclassified");
  assert.doesNotMatch(logged.join(""), /private@example|secret password|invitation code/);
});
