import { test, expect } from "@playwright/test";
import { mountedPath } from "../helpers/paths";

test("Resume material upgrades old workspaces, saves, edits, exports, and deletes", async ({page}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("interview-pal.workspace.v1")) {
      localStorage.setItem("interview-pal.workspace.v1", JSON.stringify({
        profile: {displayName: "Existing owner", targetRole: "Software engineer", weeklyGoal: 5},
        progress: {}, drafts: {}, stories: [], sessions: [], attempts: [],
      }));
    }
    localStorage.setItem("interview-pal.theme", "light");
  });
  await page.goto(mountedPath("/"));
  await page.getByRole("link", {name: "Project prep", exact: true}).click();
  await expect(page).toHaveURL(new RegExp(`${mountedPath("/project-interview")}$`));
  await expect(page.getByRole("heading", {name: "Project interview", exact: true})).toBeVisible();
  await expect(page.getByRole("link", {name: "Project prep", exact: true})).toHaveClass(/active/);
  await expect(page.locator(".breadcrumb")).toContainText("Project prep");
  await expect(page.getByText("No projects yet", {exact: true})).toBeVisible();
  await expect(page.locator(".sidebar-user")).toContainText("Existing owner");
  await page.getByLabel("Project name").fill("Checkout service · Acme");
  await page.getByLabel("Bullet point 1", {exact: true}).fill("   ");
  await page.getByRole("button", {name: "Save project", exact: true}).click();
  await expect(page.locator("#resume-bullet-error")).toContainText("Enter a resume bullet point.");

  await page.getByLabel("Project name").fill("Checkout service · Acme");
  await page.getByLabel("Bullet point 1", {exact: true}).fill("Built a checkout service that reduced payment failures by 30%.");
  await page.getByRole("button", {name: "Save project", exact: true}).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("article")).toContainText("payment failures by 30%");
  await page.getByRole("article").getByRole("button", {name: "Edit", exact: true}).click();
  await page.getByLabel("Bullet point 1", {exact: true}).fill("Discard this edit.");
  await page.getByRole("button", {name: "Cancel edit", exact: true}).click();
  await expect(page.getByRole("article")).toContainText("payment failures by 30%");
  await page.getByRole("article").getByRole("button", {name: "Edit", exact: true}).click();
  await page.getByLabel("Bullet point 1", {exact: true}).fill("Built a checkout service that reduced payment failures by 40%.");
  await page.getByRole("button", {name: "Save changes", exact: true}).click();
  await page.getByLabel("Project name").fill("Release automation");
  await page.getByLabel("Bullet point 1", {exact: true}).fill("Automated release checks and cut deployment time in half.");
  await page.getByRole("button", {name: "Save project", exact: true}).click();
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByText("2 projects", {exact: true})).toBeVisible();
  await page.screenshot({path: "/private/tmp/interview-pal-project-interview.png", fullPage: true, animations: "disabled"});

  await page.getByRole("link", {name: "Settings", exact: true}).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", {name: "Export workspace", exact: true}).click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.workspace.resumeBullets).toHaveLength(2);
  expect(backup.workspace.profile.displayName).toBe("Existing owner");

  await page.getByRole("link", {name: "Project prep", exact: true}).click();
  const checkout = page.getByRole("article").filter({hasText: "Checkout service · Acme"});
  await checkout.getByRole("button", {name: "Delete", exact: true}).click();
  await checkout.getByRole("button", {name: "Keep it", exact: true}).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await checkout.getByRole("button", {name: "Edit", exact: true}).click();
  await checkout.getByRole("button", {name: "Delete", exact: true}).click();
  await checkout.getByRole("button", {name: "Confirm delete", exact: true}).click();
  await expect(page.getByLabel("Bullet point 1", {exact: true})).toHaveValue("");
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Automated release checks");
});

test("Project interview works in mobile navigation and dark mode", async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.addInitScript(() => localStorage.setItem("interview-pal.theme", "light"));
  await page.goto(mountedPath("/"));
  await page.getByRole("button", {name: "Open navigation"}).click();
  await page.getByRole("link", {name: "Project prep", exact: true}).click();
  await expect(page.getByRole("heading", {name: "Project interview", exact: true})).toBeVisible();
  await expect(page.locator(".sidebar")).not.toHaveClass(/sidebar-open/);
  await page.getByLabel("Project name").fill("Internal search");
  await page.getByLabel("Bullet point 1", {exact: true}).fill("Built and maintained an internal search service.");
  await page.getByRole("button", {name: "Save project", exact: true}).click();
  await expect(page.getByRole("article")).toContainText("internal search service");
  await page.getByRole("button", {name: "Use dark theme"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({path: "/private/tmp/interview-pal-project-interview-mobile.png", fullPage: true, animations: "disabled"});
});

test("Projects keep separately added bullet points in order across editing and reload", async ({page}) => {
  await page.goto(mountedPath("/project-interview"));
  await page.getByLabel("Project name").fill("Checkout service");
  await page.getByLabel("Bullet point 1", {exact: true}).fill("Built the payment API.");
  await page.getByRole("button", {name: "Add bullet point", exact: true}).click();
  await expect(page.getByLabel("Bullet point 2", {exact: true})).toBeFocused();
  await page.getByLabel("Bullet point 2", {exact: true}).fill("Reduced failures by 30%.");
  await page.getByRole("button", {name: "Add bullet point", exact: true}).click();
  await page.getByLabel("Bullet point 3", {exact: true}).fill("   ");
  await page.getByRole("button", {name: "Save project", exact: true}).click();
  await expect(page.locator("#resume-bullet-error")).toContainText("Bullet point 3:");
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByRole("button", {name: "Remove bullet point 3", exact: true}).click();
  await expect(page.getByLabel("Bullet point 2", {exact: true})).toBeFocused();
  await page.getByRole("button", {name: "Save project", exact: true}).click();
  await page.reload();
  const project = page.getByRole("article").filter({hasText: "Checkout service"});
  await expect(project).toHaveCount(1);
  await expect(project.getByRole("listitem")).toHaveText(["Built the payment API.", "Reduced failures by 30%."]);
  await project.getByRole("button", {name: "Edit", exact: true}).click();
  await page.getByLabel("Project name").fill("Payment platform");
  await page.getByRole("button", {name: "Remove bullet point 1", exact: true}).click();
  await expect(page.getByLabel("Bullet point 1", {exact: true})).toHaveValue("Reduced failures by 30%.");
  await page.getByRole("button", {name: "Add bullet point", exact: true}).click();
  await page.getByLabel("Bullet point 2", {exact: true}).fill("Added observability for checkout latency.");
  await page.getByRole("button", {name: "Save changes", exact: true}).click();
  await page.reload();
  await expect(page.getByRole("article").getByRole("listitem")).toHaveText(["Reduced failures by 30%.", "Added observability for checkout latency."]);
  await expect(page.getByRole("article").getByRole("heading")).toHaveText("Payment platform");
  // Identically named projects still have independent identity.
  await page.getByLabel("Project name").fill("Payment platform");
  await page.getByLabel("Bullet point 1", {exact: true}).fill("A separate project at another company.");
  await page.getByRole("button", {name: "Save project", exact: true}).click();
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("link", {name: "Overview", exact: true}).click();
  await expect(page.locator(".metric-card").filter({hasText: "Project interview"}).locator(".metric-value")).toHaveText("2projects");
});

test("Bullet formatting previews, toggles, and survives saving and editing", async ({page}) => {
  await page.goto(mountedPath("/project-interview"));
  await page.getByLabel("Project name").fill("Search performance");
  const first = page.getByLabel("Bullet point 1", {exact: true});
  const toolbar = page.getByRole("group", {name: "Formatting for bullet point 1", exact: true});
  await first.fill("Reduced latency by 40% using Redis.");
  await first.evaluate((input: HTMLTextAreaElement) => {const start = input.value.indexOf("40%"); input.setSelectionRange(start, start + 3);});
  await toolbar.getByRole("button", {name: "Bold", exact: true}).click();
  await expect(first).toHaveValue("Reduced latency by **40%** using Redis.");
  await expect(page.getByRole("region", {name: "Preview of bullet point 1"}).locator("strong")).toHaveText("40%");
  await toolbar.getByRole("button", {name: "Bold", exact: true}).click();
  await expect(first).toHaveValue("Reduced latency by 40% using Redis.");
  await toolbar.getByRole("button", {name: "Bold", exact: true}).click();
  await first.evaluate((input: HTMLTextAreaElement) => {const start = input.value.indexOf("Redis"); input.setSelectionRange(start, start + 5);});
  await first.press("ControlOrMeta+i");
  await expect(page.getByRole("region", {name: "Preview of bullet point 1"}).locator("em")).toHaveText("Redis");
  await page.getByRole("button", {name: "Add bullet point", exact: true}).click();
  const second = page.getByLabel("Bullet point 2", {exact: true});
  await second.fill("cache.get()");
  await second.press("ControlOrMeta+a");
  await page.getByRole("group", {name: "Formatting for bullet point 2", exact: true}).getByRole("button", {name: "Inline code", exact: true}).click();
  await expect(page.getByRole("region", {name: "Preview of bullet point 2"}).locator("code")).toHaveText("cache.get()");
  await page.getByRole("button", {name: "Save project", exact: true}).click();
  await page.reload();
  const project = page.getByRole("article");
  await expect(project.locator("strong")).toHaveText("40%");
  await expect(project.locator("em")).toHaveText("Redis");
  await expect(project.locator("code")).toHaveText("cache.get()");
  await project.getByRole("button", {name: "Edit", exact: true}).click();
  await expect(first).toHaveValue("Reduced latency by **40%** using _Redis_.");
  await expect(second).toHaveValue("`cache.get()`");
  await toolbar.getByRole("button", {name: "Preview", exact: true}).click();
  await page.screenshot({path: "/private/tmp/interview-pal-bullet-formatting.png", fullPage: true, animations: "disabled"});

  // Pasted markup is displayed as text and cannot introduce executable elements or links.
  await first.fill('Built <img src=x onerror="alert(1)"> and [a tool](javascript:alert(1)).');
  const preview = page.getByRole("region", {name: "Preview of bullet point 1"});
  await expect(preview.locator("img, script, a")).toHaveCount(0);
  await expect(preview).toContainText("a tool");
  await page.getByRole("button", {name: "Save changes", exact: true}).click();
  await page.reload();
  await expect(project.locator("ul img, ul script, ul a")).toHaveCount(0);
  await expect(project).toContainText("a tool");
});
