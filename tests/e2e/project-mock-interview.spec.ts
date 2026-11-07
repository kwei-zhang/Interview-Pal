import { test, expect, type Page } from "@playwright/test";
import { mountedPath } from "../helpers/paths";
import { emptyWorkspace } from "../../src/lib/types";

const projectId = "77777777-7777-4777-8777-777777777777";
const otherProjectId = "88888888-8888-4888-8888-888888888888";
const bullets = ["Built an **idempotent** payment API.", "Reduced payment failures by 30%."];
async function seedProjects(page: Page) {
  const workspace = emptyWorkspace();
  workspace.resumeBullets = [
    {id: "11111111-1111-4111-8111-111111111111", projectId, project: "Checkout service", position: 0, text: bullets[0], updatedAt: "2026-10-10T12:00:00Z"},
    {id: "22222222-2222-4222-8222-222222222222", projectId, project: "Checkout service", position: 1, text: bullets[1], updatedAt: "2026-10-10T12:00:00Z"},
    {id: "33333333-3333-4333-8333-333333333333", projectId: otherProjectId, project: "Internal dashboard", position: 0, text: "other-project-private-material", updatedAt: "2026-10-10T12:00:00Z"},
  ];
  await page.addInitScript(value => {
    if (!localStorage.getItem("interview-pal.workspace.v1")) localStorage.setItem("interview-pal.workspace.v1", value);
  }, JSON.stringify(workspace));
}

test.beforeEach(async ({page}) => {
  await page.route("**/api/config", route => route.fulfill({json: {agentConfigured: true}}));
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {configurable: true, value: async () => {throw new DOMException("Microphone permission denied", "NotAllowedError");}});
    localStorage.setItem("interview-pal.theme", "light");
  });
});

test("Project interview requires a saved project and links to Project prep", async ({page}) => {
  await page.goto(mountedPath("/interviews"));
  await page.getByRole("button", {name: /^Project interview/}).click();
  await expect(page.getByRole("heading", {name: "Add a project to get started"})).toBeVisible();
  await expect(page.getByRole("button", {name: "Enter practice room"})).toBeDisabled();
  await expect(page.getByLabel("Problem", {exact: true})).toHaveCount(0);
  await page.getByRole("link", {name: "Go to Project prep"}).click();
  await expect(page).toHaveURL(new RegExp(`${mountedPath("/project-interview")}$`));
  await expect(page.getByRole("heading", {name: "Add a project", exact: true})).toBeVisible();
});

test("Selected resume points power a saved project conversation, resume, review and history", async ({page}) => {
  await seedProjects(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const actions: string[] = [];
  await page.route("**/api/interview-agent", route => {
    const body = route.request().postDataJSON();
    actions.push(body.action);
    expect(body.session.type).toBe("project");
    expect(body.session.project).toEqual({id: projectId, name: "Checkout service", bullets});
    expect(body.session.scratchpad).toBe("");
    expect(JSON.stringify(body)).not.toContain("other-project-private-material");
    expect(JSON.stringify(body)).not.toContain("private-scratchpad-marker");
    return route.fulfill({json: body.action === "feedback" ? {feedback: {source: "agent", summary: "You explained the payment API and your ownership.", strengths: ["Explained retry handling."], improvements: ["Explain measurement methodology."], evidence: ["I used request keys to deduplicate retries."], nextActions: ["Prepare a concrete tradeoff."], dimensions: []}} : {text: "How did you measure the reduction in payment failures?"}});
  });
  await page.goto(mountedPath("/project-interview"));
  await page.getByRole("article").filter({has: page.getByRole("heading", {name: "Checkout service", exact: true})}).getByRole("link", {name: "Practice", exact: true}).click();
  await expect(page.getByLabel("Project", {exact: true})).toHaveValue(projectId);
  await expect(page.locator("strong").filter({hasText: /^idempotent$/})).toBeVisible();
  await page.getByLabel("Project", {exact: true}).selectOption(otherProjectId);
  await expect(page.getByText("other-project-private-material", {exact: true})).toBeVisible();
  await page.getByLabel("Project", {exact: true}).selectOption(projectId);
  await page.screenshot({path: "/private/tmp/interview-pal-project-mock-setup.png", fullPage: true});
  await page.getByRole("button", {name: "Enter practice room"}).click();
  await expect(page).toHaveURL(/\/interviews\/[a-f0-9-]+$/);
  const roomUrl = page.url();
  await expect(page.getByRole("heading", {name: "Checkout service", exact: true})).toBeVisible();
  await expect(page.getByRole("log")).toContainText("Could you walk me through Checkout service");
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveCount(0);
  await page.getByLabel("Interview scratchpad").fill("private-scratchpad-marker");
  await page.getByLabel("Your response", {exact: true}).fill("I used request keys to deduplicate retries.");
  await page.getByRole("button", {name: "Send response"}).click();
  await expect(page.getByRole("log")).toContainText("How did you measure");
  await page.evaluate(() => {if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0);});
  await page.screenshot({path: "/private/tmp/interview-pal-project-mock-room.png", fullPage: true});
  await page.getByRole("link", {name: "Leave and save for later"}).click();
  await page.getByRole("link", {name: "Project prep", exact: true}).click();
  const project = page.getByRole("article").filter({has: page.getByRole("heading", {name: "Checkout service", exact: true})});
  await project.getByRole("button", {name: "Edit", exact: true}).click();
  await page.getByLabel("Bullet point 1", {exact: true}).fill("Changed after the interview began.");
  await page.getByRole("button", {name: "Save changes", exact: true}).click();
  await project.getByRole("button", {name: "Delete", exact: true}).click();
  await project.getByRole("button", {name: "Confirm delete"}).click();
  await expect(project).toHaveCount(0);
  await page.goto(roomUrl);
  await expect(page.getByRole("region", {name: "Project interview material"})).toContainText("Reduced payment failures by 30%");
  await expect(page.getByRole("region", {name: "Project interview material"})).not.toContainText("Changed after");
  await expect(page.getByRole("log").getByText(/Could you walk me through Checkout service/)).toHaveCount(1);
  await expect(page.getByLabel("Interview scratchpad")).toHaveValue("private-scratchpad-marker");
  await page.getByRole("button", {name: "Finish session"}).click();
  await expect(page).toHaveURL(/\/history\/[a-f0-9-]+$/);
  await expect(page.getByText("You explained the payment API and your ownership.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", {name: "Project interview material"})).toContainText("idempotent");
  await expect(page.getByText("private-scratchpad-marker", {exact: true})).toBeVisible();
  await page.getByRole("link", {name: "Practice again"}).click();
  await expect(page.getByText("This project is no longer available. Choose another project.")).toBeVisible();
  await expect(page.getByRole("button", {name: "Enter practice room"})).toBeDisabled();
  await page.goto(mountedPath("/history"));
  await page.getByLabel("Filter interview type").selectOption("project");
  await page.getByLabel("Search sessions").fill("Checkout");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Checkout service");
  await page.getByLabel("Filter interview type").selectOption("coding");
  await expect(page.getByText("No matching sessions", {exact: true})).toBeVisible();
  expect(actions).toEqual(["reply", "feedback"]);
  expect(errors).toEqual([]);
});

test("Project setup fits mobile and keeps OpenAI connection requirements", async ({page}) => {
  await seedProjects(page);
  await page.setViewportSize({width: 390, height: 844});
  await page.route("**/api/config", route => route.fulfill({json: {agentConfigured: false}}));
  await page.goto(mountedPath(`/interviews?type=project&project=${projectId}`));
  await expect(page.getByRole("button", {name: /^Project interview/})).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Project", {exact: true})).toHaveValue(projectId);
  await expect(page.getByRole("button", {name: "Enter practice room"})).toBeDisabled();
  await expect(page.getByText("OpenAI not connected", {exact: true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path: "/private/tmp/interview-pal-project-mock-mobile.png", fullPage: true});
});

test("The project API validates material and uses the configured provider instead of a scripted fallback", async ({request}) => {
  const now = new Date().toISOString();
  const session = {id: crypto.randomUUID(), type: "project", roleId: "software-engineer", questionId: "project-overview", durationMinutes: 30, timed: false, language: "python", status: "active", startedAt: now, lastActiveAt: now, elapsedSeconds: 0, scratchpad: "", transcript: [], adapter: "agent", project: {id: projectId, name: "Checkout service", bullets}};
  const headers = {Origin: "http://127.0.0.1:3100"};
  const invalid = await request.post(mountedPath("/api/interview-agent"), {headers, data: {action: "reply", session: {...session, project: {...session.project, bullets: []}}}});
  expect(invalid.status()).toBe(400);
  const unconfigured = await request.post(mountedPath("/api/interview-agent"), {headers, data: {action: "reply", session}});
  expect(unconfigured.status()).toBe(503);
  expect((await unconfigured.json()).error).toContain("OPENAI_API_KEY");
});
