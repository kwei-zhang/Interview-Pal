import { test, expect } from "@playwright/test";
import { emptyWorkspace, draftKey, type InterviewSession } from "../../src/lib/types";

test.beforeEach(async ({page}) => {
  await page.route("**/api/config", route => route.fulfill({json: {runnerConfigured: false, agentConfigured: true}}));
  await page.route("**/api/interview-agent", route => {
    const body = route.request().postDataJSON();
    return route.fulfill({json: body.action === "feedback" ? {feedback: {source: "agent", summary: "You explained your collaboration experience.", strengths: ["Described a concrete experience."], improvements: [], evidence: ["Discussed pairing with a teammate."], nextActions: ["Add a measurable outcome."], dimensions: []}} : {text: body.session.type === "behavioral" ? "What was your specific responsibility in that situation?" : "Which edge cases would you test?"}});
  });
  await page.addInitScript(() => {
    // Exercise typed fallback without accessing the machine's microphone.
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {configurable: true, value: async () => {throw new DOMException("Microphone permission denied", "NotAllowedError");}});
    localStorage.setItem("interview-pal.theme", "light");
    localStorage.setItem("interview-pal.plain-editor", "true");
  });
});
test("Dashboard and complete curriculum support meaningful filters", async ({page}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", {name: "A little practice. A lot more confidence."})).toBeVisible();
  await page.screenshot({path: "/private/tmp/interview-pal-dashboard.png"});
  await page.getByRole("link", {name: "Coding practice 150"}).click();
  await expect(page.getByText("1–25 of 150 problems")).toBeVisible();
  await expect(page.getByRole("checkbox", {name: "Python checks"})).toHaveCount(0);
  await expect(page.locator("tbody tr")).toHaveCount(25);
  await expect(page.locator("tbody tr").first()).toContainText("Merge Sorted Array");
  await expect(page.getByLabel("Filter topic").locator("option")).toHaveCount(24);
  await expect(page.getByRole("link", {name: "LeetCode study plan"}).last()).toHaveAttribute("href", "https://leetcode.com/studyplan/top-interview-150/");
  await page.getByLabel("Search coding problems").fill("3Sum");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByRole("link", {name: /3Sum/})).toBeVisible();
});
test("New Top Interview 150 starters switch languages, reset, and preserve drafts", async ({page}) => {
  await page.goto("/coding/merge-sorted-array");
  const editor = page.getByLabel("Solution code", {exact: true});
  await expect(editor).toHaveValue(/def merge\(nums1: List\[int\], m: int, nums2: List\[int\], n: int\) -> None:/);
  await editor.fill("# my merge draft");
  await page.getByLabel("Coding language").selectOption("javascript");
  await expect(editor).toHaveValue(/function merge\(nums1, m, nums2, n\)/);
  await page.getByLabel("Coding language").selectOption("typescript");
  await expect(editor).toHaveValue(/function merge\(nums1: number\[\], m: number, nums2: number\[\], n: number\): void/);
  await editor.fill("// temporary edit");
  await page.getByRole("button", {name: "Reset starter"}).click();
  await page.getByRole("button", {name: "Confirm reset"}).click();
  await expect(editor).toHaveValue(/function merge/);
  await page.getByLabel("Coding language").selectOption("python");
  await expect(editor).toHaveValue("# my merge draft");
  await page.reload();
  await expect(editor).toHaveValue("# my merge draft");
  await page.getByRole("link", {name: "Practice this in an interview"}).click();
  await expect(page.getByLabel("Problem", {exact: true})).toHaveValue("merge-sorted-array");
});
test("Drafts by language, notes, progress and review flags survive reload", async ({page}) => {
  await page.goto("/coding/two-sum");
  await page.getByLabel("Solution code", {exact: true}).fill("def twoSum(nums, target):\n    return [0, 1]\n");
  await page.getByLabel("Coding language").selectOption("typescript");
  await page.getByLabel("Solution code", {exact: true}).fill("function twoSum(nums: number[], target: number): number[] { return [1, 0]; }");
  await page.getByLabel("Your notes").fill("Use a hash map and explain the tradeoff.");
  await page.getByLabel("Problem progress").selectOption("solved");
  await page.getByRole("button", {name: "Review later", exact: true}).click();
  await page.reload();
  await expect(page.getByLabel("Coding language")).toHaveValue("typescript");
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveValue(/function twoSum/);
  await expect(page.getByLabel("Your notes")).toHaveValue("Use a hash map and explain the tradeoff.");
  await expect(page.getByLabel("Problem progress")).toHaveValue("solved");
  await expect(page.getByRole("button", {name: "On review list"})).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Coding language").selectOption("python");
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveValue("def twoSum(nums, target):\n    return [0, 1]\n");
});
test("External catalog problems still support saved notes and progress", async ({page}) => {
  await page.goto("/coding/median-of-two-sorted-arrays");
  await expect(page.getByRole("link", {name: "Open on LeetCode"})).toHaveAttribute("href", "https://leetcode.com/problems/median-of-two-sorted-arrays/");
  await page.getByLabel("Your notes").fill("Review partition boundaries.");
  await page.reload(); await expect(page.getByLabel("Your notes")).toHaveValue("Review partition boundaries.");
});
test("STAR stories link to multiple questions and survive reload", async ({page}) => {
  await page.goto("/behavioral");
  await page.getByRole("button", {name: "Add a story", exact: true}).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Story title").fill("Unblocking the release");
  await dialog.getByLabel("Situation", {exact: true}).fill("A release was blocked by a flaky integration.");
  await dialog.getByLabel("Task", {exact: true}).fill("I owned the investigation.");
  await dialog.getByLabel("Action", {exact: true}).fill("I paired with another team and isolated the race.");
  await dialog.getByLabel("Result", {exact: true}).fill("We shipped and reduced test retries.");
  await dialog.getByRole("button", {name: "Teamwork", exact: true}).click();
  await dialog.getByRole("checkbox", {name: "Tell me about a project where collaboration made the difference."}).check();
  await dialog.getByRole("checkbox", {name: "Describe a problem you took ownership of without being asked."}).check();
  await dialog.getByRole("button", {name: "Save story"}).click();
  await expect(page.getByRole("heading", {name: "Unblocking the release"})).toBeVisible();
  await expect(page.getByText(/2 linked/)).toBeVisible();
  await page.reload();
  await page.getByRole("tab", {name: /Practice questions/}).click();
  await expect(page.getByRole("button", {name: "Unblocking the release"})).toHaveCount(2);
});
test("Behavioral AI practice saves ordered transcripts and feedback", async ({page}) => {
  await page.goto("/interviews?type=behavioral&question=team-collaboration&timed=false");
  await expect(page.getByLabel("Opening question")).toHaveValue("team-collaboration");
  await page.getByRole("button", {name: "Enter practice room"}).click();
  await expect(page).toHaveURL(/\/interviews\/[a-f0-9-]+/);
  await expect(page.getByRole("log")).toContainText("collaboration made the difference");
  await page.getByLabel("Your response", {exact: true}).fill("I paired with a teammate to fix an integration issue.");
  await page.getByRole("button", {name: "Send response"}).click();
  await expect(page.getByRole("log")).toContainText("specific responsibility");
  await page.getByLabel("Interview scratchpad").fill("Focus on my role and measurable outcome.");
  await page.getByRole("button", {name: "Finish session"}).click();
  await expect(page).toHaveURL(/\/history\/[a-f0-9-]+/);
  await expect(page.getByText("You explained your collaboration experience.")).toBeVisible();
  await expect(page.getByText("I paired with a teammate to fix an integration issue.", {exact: true})).toBeVisible();
  await expect(page.getByText("Focus on my role and measurable outcome.", {exact: true})).toBeVisible();
  await page.reload(); await expect(page.getByText("I paired with a teammate to fix an integration issue.", {exact: true})).toBeVisible();
});
test("Interrupted coding sessions resume without duplicate openings", async ({page}) => {
  await page.goto("/interviews?type=coding&question=two-sum");
  await page.getByRole("button", {name: "Enter practice room"}).click();
  await expect(page).toHaveURL(/\/interviews\/[a-f0-9-]+/);
  const roomUrl = page.url();
  await expect(page.locator(".transcript-message.interviewer")).toHaveCount(1);
  await page.getByLabel("Solution code", {exact: true}).fill("def twoSum(nums, target):\n    return [0, 1]");
  await page.getByRole("link", {name: "Leave and save for later"}).click();
  await expect(page.getByRole("heading", {name: "Pick up a previous session"})).toBeVisible();
  await page.goto("/history");
  await expect(page.getByText("Interrupted", {exact: true})).toBeVisible();
  await page.getByRole("link", {name: "Resume", exact: true}).click();
  await expect(page).toHaveURL(roomUrl);
  await expect(page.locator(".transcript-message.interviewer")).toHaveCount(1);
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveValue("def twoSum(nums, target):\n    return [0, 1]");
});
test("Retired question links still preserve drafts without a local runner", async ({page}) => {
  await page.goto("/coding/contains-duplicate");
  await page.getByLabel("Solution code", {exact: true}).fill("# saved work on a retired question");
  await expect(page.getByRole("link", {name: "Practice on LeetCode"})).toHaveAttribute("href", "https://leetcode.com/problems/contains-duplicate/");
  await expect(page.getByRole("button", {name: /Run examples|Submit tests/})).toHaveCount(0);
  await expect(page.locator(".test-result")).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveValue("# saved work on a retired question");
});
test("Mobile navigation and themes remain usable", async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto("/");
  await page.getByRole("button", {name: "Open navigation"}).click();
  await page.getByRole("link", {name: "Behavioral prep", exact: true}).click();
  await expect(page.getByRole("heading", {name: "Find the story behind your skills."})).toBeVisible();
  await page.getByRole("button", {name: "Use dark theme"}).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflowing).toBe(false);
});
test("Unconfigured and cross-origin API requests cannot access private data", async ({request}) => {
  const read = await request.get("/api/workspace"); expect(read.status()).toBe(503);
  const write = await request.patch("/api/workspace", {headers: {Origin: "https://untrusted.example"}, data: {kind: "profile", value: {}}}); expect(write.status()).toBe(403);
  const run = await request.post("/api/execution", {headers: {Origin: "http://127.0.0.1:3100"}, data: {problemId: "two-sum", language: "python", code: "code", mode: "run"}}); expect(run.status()).toBe(404);
});

test("Monaco loads from local assets and edits save without editor errors", async ({page}) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/coding/two-sum");
  await page.getByLabel("Solution code", {exact: true}).fill("");
  await page.getByRole("button", {name: "Use Monaco editor", exact: true}).click();
  const editor = page.locator(".monaco-editor textarea");
  await expect(editor).toBeVisible();
  await page.locator(".monaco-editor .view-lines").click();
  await editor.pressSequentially("# saved in Monaco", {delay: 10});
  await page.getByRole("button", {name: "Use plain text editor", exact: true}).click();
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveValue("# saved in Monaco");
  await page.reload();
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveValue("# saved in Monaco");
  expect(errors).toEqual([]);
});

test("Conversational AI answers constraint questions and saves an evidence-based review", async ({page}) => {
  await page.route("**/api/config", route => route.fulfill({json: {runnerConfigured: false, agentConfigured: true, agentProvider: "openai"}}));
  await page.route("**/api/interview-agent", async route => {
    const body = route.request().postDataJSON();
    expect(body.session.adapter).toBe("agent"); expect(body.session.scratchpad).toBe("");
    if (body.action === "reply") {
      expect(body.session.transcript.at(-1).text).toBe("Can nums be empty? What are the constraints?");
      expect(body.context.language).toBe("typescript"); expect(body.context.code).toContain("containsNearbyDuplicate");
      await route.fulfill({json: {text: "Yes. Empty input returns false; k is nonnegative."}});
    } else {
      expect(body.action).toBe("feedback");
      await route.fulfill({json: {feedback: {source: "agent", summary: "You clarified the input assumptions.", strengths: ["Checked the empty input case."], improvements: ["Explain your approach next."], evidence: ["Asked whether nums can be empty."], nextActions: ["Discuss complexity."], dimensions: [{name: "Clarification", observation: "Asked about the boundaries before coding."}]}}});
    }
  });
  await page.goto("/interviews?question=contains-duplicate-ii&timed=false");
  await page.getByRole("button", {name: "Enter practice room"}).click();
  await expect(page.getByRole("log")).toContainText("Let's work on Contains Duplicate II");
  await page.getByLabel("Coding language").selectOption("typescript");
  await page.getByLabel("Your response", {exact: true}).fill("Can nums be empty? What are the constraints?");
  await page.getByRole("button", {name: "Send response"}).click();
  await expect(page.getByRole("log")).toContainText("k is nonnegative");
  await page.getByRole("button", {name: "Finish session"}).click();
  await expect(page).toHaveURL(/\/history\/[a-f0-9-]+/);
  await expect(page.getByText("You clarified the input assumptions.")).toBeVisible();
  await expect(page.getByText("Asked about the boundaries before coding.")).toBeVisible();
  await page.reload(); await expect(page.getByText("k is nonnegative", {exact: false})).toBeVisible();
});

test("AI provider failure saves the candidate turn once, supports retry, and preserves interrupted work", async ({page}) => {
  await page.route("**/api/config", route => route.fulfill({json: {runnerConfigured: false, agentConfigured: true}}));
  let replies = 0;
  await page.route("**/api/interview-agent", route => {
    replies++;
    return replies === 1 ? route.fulfill({status: 503, json: {error: "The AI connection failed. Your work is saved."}}) : route.fulfill({json: {text: "Empty inputs are allowed."}});
  });
  await page.goto("/interviews?question=contains-duplicate-ii&timed=false");
  await page.getByRole("button", {name: "Enter practice room"}).click();
  await page.getByLabel("Your response", {exact: true}).fill("Can it be empty?");
  await page.getByRole("button", {name: "Send response"}).click();
  await expect(page.getByRole("alert").filter({hasText: "AI connection failed"})).toBeVisible();
  await expect(page.getByLabel("Your response", {exact: true})).toHaveValue("Can it be empty?");
  await page.getByRole("button", {name: "Send response"}).click();
  await expect(page.getByRole("log")).toContainText("Empty inputs are allowed.");
  await expect(page.locator(".transcript-message.candidate")).toHaveCount(1);
  const url = page.url();
  await page.getByRole("link", {name: "Leave and save for later"}).click();
  await page.goto(url);
  await expect(page.getByRole("log")).toContainText("Empty inputs are allowed.");
  await expect(page.locator(".transcript-message.candidate")).toHaveCount(1);
});

test("Earlier interrupted sessions resume directly with AI and preserve saved work", async ({page}) => {
  const workspace = emptyWorkspace();
  const now = new Date().toISOString(), id = crypto.randomUUID();
  const session: InterviewSession = {id, roleId: "software-engineer", type: "coding", questionId: "two-sum", language: "python", durationMinutes: 45, timed: false, status: "interrupted", startedAt: now, lastActiveAt: now, elapsedSeconds: 120, scratchpad: "", adapter: "mock", transcript: [{id: crypto.randomUUID(), role: "interviewer", text: "Saved opening question", timestamp: now}]};
  workspace.sessions.push(session);
  workspace.drafts[draftKey("two-sum", "python")] = {problemId: "two-sum", language: "python", code: "def twoSum(nums, target):\n    # saved before resuming\n    pass", updatedAt: now};
  await page.addInitScript(serialized => localStorage.setItem("interview-pal.workspace.v1", serialized), JSON.stringify(workspace));
  await page.goto(`/interviews/${id}`);
  await expect(page.getByText("OpenAI interviewer", {exact: true})).toBeVisible();
  await expect(page.locator(".transcript-message.interviewer")).toHaveCount(1);
  await expect(page.getByRole("log")).toContainText("Saved opening question");
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveValue(/saved before resuming/);
  await expect(page.locator(".timer")).toContainText("02:");
  await page.getByLabel("Your response", {exact: true}).fill("What should I consider?");
  await page.getByRole("button", {name: "Send response"}).click();
  await expect(page.getByRole("log")).toContainText("Which edge cases would you test?");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("interview-pal.workspace.v1")!));
  expect(saved.sessions[0].adapter).toBe("agent");
});

test("Starting an interview requires OpenAI and offers no scripted fallback", async ({page}) => {
  await page.route("**/api/config", route => route.fulfill({json: {runnerConfigured: false, agentConfigured: false}}));
  await page.goto("/interviews");
  await expect(page.getByText("OpenAI not connected", {exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: "Enter practice room"})).toBeDisabled();
  await expect(page.getByRole("combobox", {name: "Interviewer", exact: true})).toHaveCount(0);
  await expect(page.getByText(/scripted|fixed follow-ups/i)).toHaveCount(0);
});

test("Typed code verification is preserved in the completed review", async ({page}) => {
  await page.route("**/api/interview-agent", route => {
    const body = route.request().postDataJSON();
    if (body.action === "feedback") return route.fulfill({json: {feedback: {source: "agent", summary: "Python passed the supplied checks.", strengths: [], improvements: [], evidence: ["Duplicate case passed."], nextActions: [], dimensions: []}}});
    return route.fulfill({json: {text: "The supplied test passed.", attempts: [{id: crypto.randomUUID(), provider: "openai-code-interpreter", sessionId: body.session.id, problemId: body.session.questionId, problemVersion: 1, language: "python", code: body.context.code, mode: "submit", createdAt: new Date().toISOString(), result: {status: "passed", stdout: "", tests: [{name: "Duplicate case", passed: true, expected: true, actual: true}]}}]}});
  });
  await page.goto("/interviews?question=contains-duplicate-ii&timed=false");
  await page.getByRole("button", {name: "Enter practice room"}).click();
  await expect(page.getByRole("log")).toContainText("Let's work on Contains Duplicate II");
  await page.getByLabel("Solution code", {exact: true}).fill("def containsNearbyDuplicate(nums, k): return any(nums[i] == nums[j] and j - i <= k for i in range(len(nums)) for j in range(i + 1, len(nums)))");
  await page.getByRole("button", {name: "Ask interviewer to judge"}).click();
  await expect(page.locator(".test-panel")).toContainText("1 / 1 tests");
  await page.getByRole("button", {name: "Finish session"}).click();
  await expect(page).toHaveURL(/\/history\//);
  await expect(page.getByText("Python passed the supplied checks.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Python passed the supplied checks.")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("interview-pal.workspace.v1")!));
  expect(saved.attempts).toHaveLength(1); expect(saved.attempts[0].code).toContain("any(nums[i] == nums[j]");
});


test("All 150 interview questions are available, including class-design tasks and saved drafts", async ({page}) => {
  await page.goto("/interviews?question=lru-cache&timed=false");
  await expect(page.getByLabel("Problem", {exact: true}).locator("option")).toHaveCount(150);
  await expect(page.getByLabel("Problem", {exact: true})).toHaveValue("lru-cache");
  await page.getByLabel("Focus area").selectOption("Graph General");
  await expect(page.getByLabel("Problem", {exact: true}).locator("option")).toHaveCount(6);
  await page.getByLabel("Problem", {exact: true}).selectOption("evaluate-division");
  await page.getByRole("button", {name: "Enter practice room"}).click();
  await expect(page.getByRole("heading", {name: "Evaluate Division", exact: true})).toBeVisible();
  await expect(page.locator(".problem-prompt")).toContainText("equations are consistent");
  await expect(page.getByLabel("Solution code", {exact: true})).toBeVisible();
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveValue(/def calcEquation\(equations: List\[List\[str\]\], values: List\[float\], queries: List\[List\[str\]\]\) -> List\[float\]:/);
  await expect(page.getByRole("button", {name: "Ask interviewer to judge"})).toBeEnabled();
  await page.getByLabel("Solution code", {exact: true}).fill("# saved evaluate division approach");
  await page.reload();
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveValue("# saved evaluate division approach");
  await page.getByRole("button", {name: "Finish session"}).click();
  await expect(page).toHaveURL(/\/history\//);
  await expect(page.getByRole("heading", {name: /Evaluate Division/})).toBeVisible();
  await page.goto("/coding/lru-cache");
  await expect(page.locator(".problem-prompt")).toContainText("least recently used");
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveValue(/class LRUCache:[\s\S]*def __init__\(self, capacity: int\)/);
  await page.getByLabel("Solution code", {exact: true}).fill("# Write or paste your Python solution here.\n");
  await page.reload();
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveValue(/class LRUCache:/);
  await page.getByLabel("Coding language").selectOption("typescript");
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveValue(/class LRUCache[\s\S]*constructor\(capacity: number\)[\s\S]*get\(key: number\): number/);
  await page.getByLabel("Coding language").selectOption("javascript");
  await expect(page.getByLabel("Solution code", {exact: true})).toHaveValue(/class LRUCache[\s\S]*constructor\(capacity\)[\s\S]*put\(key, value\)/);
  await page.getByRole("link", {name: "Practice this in an interview"}).click();
  await expect(page.getByLabel("Problem", {exact: true})).toHaveValue("lru-cache");
});

test("LLM reasoning judgments are clearly labeled and survive saved reviews", async ({page}) => {
  await page.route("**/api/interview-agent", route => {
    const body = route.request().postDataJSON();
    if (body.action === "feedback") return route.fulfill({json: {feedback: {source: "agent", summary: "Code was reviewed by reasoning.", strengths: [], improvements: [], evidence: [], nextActions: [], dimensions: []}}});
    const attempts = body.session.transcript.some((e: {text: string}) => e.text.includes("Please judge")) ? [{id: crypto.randomUUID(), provider: "openai-judge", sessionId: body.session.id, problemId: body.session.questionId, problemVersion: 1, language: "typescript", code: body.context.code, mode: "submit", createdAt: new Date().toISOString(), result: {status: "reviewed", stdout: "", tests: [], assessment: {method: "llm-review", verdict: "inconclusive", summary: "Required cache methods are incomplete."}}}] : [];
    return route.fulfill({json: {text: "This is a reasoning assessment; the TypeScript was not executed.", attempts}});
  });
  await page.goto("/interviews?question=lru-cache&timed=false");
  await page.getByLabel("Coding language").selectOption("typescript");
  await page.getByRole("button", {name: "Enter practice room"}).click();
  await page.getByLabel("Solution code", {exact: true}).fill("class LRUCache {}");
  await page.getByRole("button", {name: "Ask interviewer to judge"}).click();
  await expect(page.locator(".test-panel")).toContainText("AI review · not executed");
  await expect(page.locator(".test-panel")).toContainText("inconclusive");
  await expect(page.locator(".test-panel")).not.toContainText("Passed");
  await page.getByRole("button", {name: "Finish session"}).click();
  await expect(page).toHaveURL(/\/history\//);
  await page.reload();
  await page.getByText("TypeScript · AI reasoning review").click();
  await expect(page.getByText("Required cache methods are incomplete.", {exact: false})).toBeVisible();
});
