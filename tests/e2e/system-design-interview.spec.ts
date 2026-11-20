import { expect, test } from "@playwright/test";
import { systemDesignTopics } from "../../src/lib/data/system-design";
import { mountedPath } from "../helpers/paths";

test("Design topic follows the candidate through a conversation, resume, review, and practice again", async ({page}) => {
  const topic = systemDesignTopics.filter(item => !item.archived).at(-1)!;
  await page.route("**/api/config", route => route.fulfill({json: {agentConfigured: true}}));
  await page.addInitScript(() => {Object.defineProperty(window, "RTCPeerConnection", {value: undefined});});
  const followup = "What happens if the request is retried?";
  const summary = "You explained how you would handle duplicate requests.";
  await page.route("**/api/interview-agent", route => {
    const {action, session} = route.request().postDataJSON();
    expect(session.type).toBe("system-design");
    expect(session.questionId).toBe(topic.id);
    expect(session.scratchpad).toBe("");
    return route.fulfill({json: action === "feedback"
      ? {feedback: {source: "agent", summary, strengths: [], improvements: [], evidence: [], nextActions: [], dimensions: []}}
      : {text: followup}});
  });

  await page.goto(mountedPath("/interviews/system-design"));
  const picker = page.getByLabel("Topic", {exact: true});
  const start = page.getByRole("button", {name: "Enter practice room"});
  await expect(picker).toHaveValue("");
  await expect(start).toBeDisabled();
  await page.getByRole("button", {name: /^Coding interview/}).click();
  await page.getByRole("button", {name: /^System design interview/}).click();
  await picker.selectOption(topic.id);
  await start.click();
  await expect(page.getByRole("heading", {name: topic.title, exact: true})).toBeVisible();
  await expect(page.getByRole("log")).toContainText(topic.prompt);
  await page.getByLabel("Interview scratchpad").fill("Private design notes");
  await page.getByLabel("Your response", {exact: true}).fill("I would assign each request a unique ID.");
  await page.getByRole("button", {name: "Send response"}).click();
  await expect(page.getByRole("log")).toContainText(followup);
  await page.getByRole("link", {name: "Leave and save for later"}).click();
  await page.getByRole("link", {name: "Session history", exact: true}).click();
  await page.getByLabel("Filter interview type").selectOption("system-design");
  await page.getByRole("article").filter({hasText: topic.title}).getByRole("link", {name: "Resume", exact: true}).click();
  await expect(page.getByLabel("Interview scratchpad")).toHaveValue("Private design notes");
  await expect(page.getByRole("log").getByText(topic.prompt, {exact: true})).toHaveCount(1);
  await page.getByRole("button", {name: "Finish session"}).click();
  await expect(page.getByText(summary, {exact: true})).toBeVisible();
  await page.getByRole("link", {name: "Practice again"}).click();
  await expect(picker).toHaveValue(topic.id);
});
