import { test } from "node:test";
import assert from "node:assert/strict";
import { archivedProblems, codingCollection, problemById, problems, topics } from "../src/lib/data/catalog";
import { interviewQuestion } from "../src/lib/problems/interview-questions";
import { sessionSchema } from "../src/lib/validation";
import { interviewerInstructions } from "../src/lib/server/openai-interviewer";
import { definitions } from "../src/lib/problems/definitions";
import { behavioralQuestions } from "../src/lib/data/behavioral";
import { interviewModules } from "../src/lib/interview/modules";
test("Verified LeetCode Top Interview 150 has the official order, topics, and difficulty distribution", () => {
  assert.equal(problems.length, 150); assert.equal(new Set(problems.map(p => p.id)).size, 150);
  assert.equal(topics.length, 23);
  assert.deepEqual(["Easy", "Medium", "Hard"].map(d => problems.filter(p => p.difficulty === d).length), [39, 93, 18]);
  assert.deepEqual(problems.slice(0, 4).map(p => p.id), ["merge-sorted-array", "remove-element", "remove-duplicates-from-sorted-array", "remove-duplicates-from-sorted-array-ii"]);
  assert.equal(problems.at(-1)?.id, "maximal-square");
  assert.equal(problems.filter(p => p.topic === "Array / String").length, 24);
  assert.equal(problems.filter(p => p.topic === "Stack").length, 5);
  assert.equal(problems.filter(p => p.topic === "Backtracking").length, 7);
  assert.ok(problems.every(p => p.collectionId === codingCollection.id));
  assert.ok(problems.every(p => p.sourceUrl === `https://leetcode.com/problems/${p.id}/`));
});
test("Retired questions preserve saved-session lookup without appearing in the active curriculum", () => {
  assert.equal(archivedProblems.length, 73);
  assert.equal(problems.some(p => p.id === "contains-duplicate"), false);
  assert.equal(problemById("contains-duplicate")?.title, "Contains Duplicate");
  assert.ok(archivedProblems.every(p => !problems.some(current => current.id === p.id) && interviewQuestion(p.id)));
  assert.equal(problemById("does-not-exist"), undefined);
});
test("The original briefs keep public examples without fixed tests", () => {
  for (const d of Object.values(definitions)) {assert.equal(d.examples.length, 2); assert.equal("tests" in d, false);}
});
test("Behavioral questions and module capabilities are independent of coding", () => {
  assert.equal(behavioralQuestions.length, 20);
  assert.equal(new Set(behavioralQuestions.map(q => q.id)).size, 20);
  assert.ok(interviewModules.coding.capabilities.includes("code"));
  assert.ok(!interviewModules.behavioral.capabilities.includes("code"));
  assert.equal(interviewModules.behavioral.questions.length, 20);
});


test("All 150 catalog problems are selectable, valid sessions with grounded interview context", () => {
  assert.deepEqual(interviewModules.coding.questions.map(q => q.id), problems.map(p => p.id));
  const now = new Date().toISOString();
  for (const problem of problems) {
    const brief = interviewQuestion(problem.id);
    assert.ok(brief, problem.id);
    assert.ok(brief.prompt.length > 40, problem.id);
    assert.ok(brief.examples.length > 0 && brief.examples.every(e => e.input && e.output), problem.id);
    assert.ok(Object.values(brief.starters).every(code => code.length > 0), problem.id);
    const session = sessionSchema.parse({id: crypto.randomUUID(), type: "coding", roleId: "software-engineer", questionId: problem.id, language: "python", durationMinutes: 45, timed: true, status: "active", startedAt: now, lastActiveAt: now, elapsedSeconds: 0, scratchpad: "", transcript: [], adapter: "agent"});
    const instructions = interviewerInstructions({action: "reply", session});
    assert.ok(instructions.includes(JSON.stringify(brief.prompt)), problem.id);
    assert.ok(instructions.includes(problem.sourceUrl), problem.id);
    assert.ok(instructions.includes(JSON.stringify(brief.starters.python)), problem.id);
  }
  assert.equal(interviewQuestion("does-not-exist"), undefined);
});
