import { test, expect, type Page } from "@playwright/test";
import { adminId, memberId } from "../helpers/auth-database";

const mount = process.env.TEST_BASE_PATH || "";
const appPath = (path: string) => path === "/" && mount ? mount : `${mount}${path}`;
const appUrl = (path: string) => `http://127.0.0.1:3102${appPath(path)}`;

const adminEmail = "zhangkw0622@gmail.com";
async function login(page: Page, email = adminEmail, password = "Admin-password-2026") {
  await page.goto(appPath("/login")); await page.getByLabel("Email", {exact: true}).fill(email);
  await page.getByLabel("Password", {exact: true}).fill(password);
  await page.getByRole("button", {name: "Sign in", exact: true}).click();
  await expect(page).toHaveURL(appUrl("/"));
}
test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {localStorage.setItem("interview-pal.plain-editor", "true"); localStorage.setItem("interview-pal.theme", "light");});
});

test("Admin invites a member; member verifies, saves a private draft, and recovers password", async ({page, browser, request}) => {
  const email = "invited-flow@example.test", password = "Candidate-password-2026";
  await login(page); await page.getByRole("link", {name: "Administration"}).click();
  await page.getByLabel("Recipient email").fill(email);
  await page.getByRole("button", {name: "Create or replace invite"}).click();
  const code = await page.getByLabel("Invitation code to share").inputValue();
  await expect(page.getByRole("cell", {name: email, exact: true})).toBeVisible();
  await page.screenshot({path: "/private/tmp/interview-pal-admin.png"});
  await page.reload(); await expect(page.getByLabel("Invitation code to share")).toHaveCount(0);

  const candidateContext = await browser.newContext();
  const candidate = await candidateContext.newPage();
  await candidate.addInitScript(() => localStorage.setItem("interview-pal.plain-editor", "true"));
  await candidate.goto(appUrl("/signup"));
  await candidate.getByLabel("Your name").fill("Invited Candidate");
  await candidate.getByLabel("Invitation code", {exact: true}).fill(code);
  await candidate.getByLabel("Email", {exact: true}).fill(email);
  await candidate.getByLabel("Password", {exact: true}).fill(password);
  await candidate.getByLabel("Confirm password").fill(password);
  await candidate.screenshot({path: "/private/tmp/interview-pal-signup.png"});
  await candidate.getByRole("button", {name: "Create account"}).click();
  await expect(candidate.getByRole("heading", {name: "Check your inbox."})).toBeVisible();
  await candidate.goto(appUrl("/login"));
  await candidate.getByLabel("Email", {exact: true}).fill(email); await candidate.getByLabel("Password", {exact: true}).fill(password);
  await candidate.getByRole("button", {name: "Sign in", exact: true}).click();
  await expect(candidate.locator(".form-error[role=alert]")).toContainText("Verify your email first");
  await candidate.getByRole("link", {name: "Resend verification email"}).click();
  await expect(candidate.getByRole("heading", {name: "Verify your email."})).toBeVisible();
  await candidate.getByLabel("Email", {exact: true}).fill(email);
  await candidate.getByRole("button", {name: "Resend confirmation"}).click();
  await expect(candidate.getByRole("heading", {name: "Check your inbox."})).toBeVisible();
  const message = await (await request.get(`http://127.0.0.1:54329/__test/mailbox?email=${email}`)).json();
  expect(message.redirectTo).toBe(`https://interview.example.test${mount}/auth/confirm`);
  await candidate.goto(appUrl(`/auth/confirm?token_hash=${message.token}&type=email`));
  await candidate.getByRole("button", {name: "Confirm email", exact: true}).click();
  await expect(candidate).toHaveURL(appUrl("/"));
  await expect(candidate.getByRole("link", {name: "Administration"})).toHaveCount(0);
  await candidate.goto(appUrl("/coding/two-sum"));
  await candidate.getByLabel("Solution code", {exact: true}).fill("# candidate's private draft");
  await expect(candidate.getByText("All changes saved")).toBeVisible();
  await candidate.reload(); await expect(candidate.getByLabel("Solution code", {exact: true})).toHaveValue("# candidate's private draft");
  const forbidden = await candidate.request.get(appUrl("/api/admin/users"), {headers: {"x-workspace-user-id": message.userId}});
  expect(forbidden.status()).toBe(403);

  await page.getByRole("tab", {name: "Users", exact: true}).click();
  const row = page.getByRole("row").filter({has: page.getByText(email, {exact: true})});
  await row.getByRole("button", {name: "Suspend", exact: true}).click();
  await expect(row.getByText("Suspended", {exact: true})).toBeVisible();
  const blocked = await candidate.request.get(appUrl("/api/workspace"), {headers: {"x-workspace-user-id": message.userId}});
  expect(blocked.status()).toBe(403);
  await candidate.goto(appUrl("/account-access"));
  await candidate.getByRole("button", {name: "Sign out", exact: true}).click();
  await expect(candidate).toHaveURL(/\/login$/);
  await row.getByRole("button", {name: "Restore access"}).click();
  await expect(row.getByText("Active", {exact: true})).toBeVisible();

  await candidate.getByRole("link", {name: "Forgot password?"}).click();
  await expect(candidate.getByRole("heading", {name: "Let’s get you back in."})).toBeVisible();
  await candidate.getByLabel("Email", {exact: true}).fill(email);
  await candidate.getByRole("button", {name: "Send reset link"}).click();
  await expect(candidate.getByRole("heading", {name: "Check your inbox."})).toBeVisible();
  const recovery = await (await request.get(`http://127.0.0.1:54329/__test/mailbox?email=${email}`)).json();
  expect(recovery.redirectTo).toBe(`https://interview.example.test${mount}/auth/confirm`);
  await candidate.goto(appUrl(`/auth/confirm?token_hash=${recovery.token}&type=recovery`));
  await candidate.getByRole("button", {name: "Continue to password reset"}).click();
  await expect(candidate).toHaveURL(/\/reset-password$/);
  await candidate.getByLabel("Password", {exact: true}).fill("Changed-password-2026");
  await candidate.getByLabel("Confirm password").fill("Changed-password-2026");
  await candidate.getByRole("button", {name: "Update password"}).click();
  await expect(candidate).toHaveURL(/\/login\?notice=password-updated$/);
  await login(candidate, email, "Changed-password-2026");
  await candidateContext.close();
});

test("Admin can replace and revoke codes; invalid and expired links have recovery paths", async ({page, request}) => {
  await login(page); await page.goto(appPath("/admin"));
  const email = "replacement@example.test";
  await page.getByLabel("Recipient email").fill(email); await page.getByRole("button", {name: "Create or replace invite"}).click();
  const oldCode = await page.getByLabel("Invitation code to share").inputValue();
  await page.getByLabel("Recipient email").fill(email); await page.getByRole("button", {name: "Create or replace invite"}).click();
  await expect(page.getByLabel("Invitation code to share")).not.toHaveValue(oldCode);
  const invalid = await request.post(appPath("/api/auth/signup"), {headers: {origin: "http://127.0.0.1:3102"}, data: {email, password: "Long-password-2026", displayName: "Someone", inviteCode: oldCode}});
  expect(invalid.status()).toBe(400);
  const pending = page.getByRole("row").filter({hasText: email}).filter({hasText: "Pending"});
  await pending.getByRole("button", {name: "Revoke", exact: true}).click();
  await expect(page.getByRole("row").filter({hasText: email}).filter({hasText: "Revoked"})).toHaveCount(2);
  await page.goto(appPath("/auth/confirm?token_hash=expired-token&type=email"));
  await page.getByRole("button", {name: "Confirm email", exact: true}).click();
  await expect(page.locator(".form-error[role=alert]")).toContainText("invalid or expired");
  await expect(page.getByRole("link", {name: "Request a new email"})).toHaveAttribute("href", appPath("/verify-email"));
});

test("Another tab signing in clears old state and stale saves/beacons cannot cross accounts", async ({page, context}) => {
  await login(page); await page.goto(appPath("/coding/two-sum"));
  await page.getByLabel("Solution code", {exact: true}).fill("# admin-only work");
  await expect(page.getByText("All changes saved")).toBeVisible();
  const second = await context.newPage();
  await login(second, "member@example.test", "Member-password-2026");
  await expect(page).toHaveURL(/\/login\?notice=account-changed$/);
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveCount(0);
  const mutation = {kind: "profile", value: {displayName: "Leaked admin name", targetRole: "Engineer", weeklyGoal: 5}};
  for (const path of ["/api/workspace", "/api/workspace/beacon"]) {
    const response = await second.request.fetch(appPath(path), {method: path.endsWith("beacon") ? "POST" : "PATCH", headers: {origin: "http://127.0.0.1:3102"}, data: {userId: adminId, mutation}});
    expect(response.status()).toBe(409);
  }
  const data = await (await second.request.get(appPath("/api/workspace"), {headers: {"x-workspace-user-id": memberId}})).json();
  expect(data.profile.displayName).not.toBe("Leaked admin name");
  expect(Object.values(data.drafts)).not.toContainEqual(expect.objectContaining({code: "# admin-only work"}));
  await second.close();
});

test("Unauthenticated APIs and cross-origin auth mutations are rejected", async ({request}) => {
  const protectedPage = await request.get(appPath("/"), {maxRedirects: 0});
  expect(protectedPage.headers().location).toBe(appPath("/login"));
  expect((await request.get(appPath("/api/admin/users"))).status()).toBe(401);
  expect((await request.get(appPath("/api/workspace"))).status()).toBe(401);
  for (const action of ["signup", "confirm", "resend", "forgot-password", "reset-password", "logout"]) {
    expect((await request.post(appPath(`/api/auth/${action}`), {headers: {origin: "https://another.example"}, data: {}})).status()).toBe(403);
  }
});

test("Navigation, Monaco assets, cookies, and agent requests stay in the app path", async ({page, context}) => {
  const rootRequests: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (mount && url.protocol === "http:" && url.origin === "http://127.0.0.1:3102" && !url.pathname.startsWith(`${mount}/`) && url.pathname !== mount) rootRequests.push(url.pathname);
  });
  await login(page);
  await expect(page.getByRole("link", {name: "Overview", exact: true})).toHaveClass(/active/);
  const cookies = (await context.cookies()).filter(cookie => cookie.name.startsWith("sb-"));
  expect(cookies.length).toBeGreaterThan(0);
  expect(cookies.every(cookie => cookie.path === (mount || "/"))).toBe(true);
  await page.getByRole("link", {name: "Coding practice"}).click();
  await expect(page.getByRole("link", {name: "Coding practice"})).toHaveClass(/active/);
  await page.getByRole("link", {name: "Two Sum", exact: false}).first().click();
  await page.getByRole("button", {name: "Use Monaco editor"}).click();
  await expect(page.locator(".monaco-editor").first()).toBeVisible({timeout: 30000});
  const agent = await page.request.post(appPath("/api/interview-agent"), {headers: {origin: "http://127.0.0.1:3102", "x-workspace-user-id": adminId}, data: {}});
  expect(agent.status()).toBe(400);
  expect(rootRequests).toEqual([]);
});
