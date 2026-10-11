import { test } from "node:test";
import assert from "node:assert/strict";
import { problems, topics, runnableProblems } from "../src/lib/data/catalog";
import { definitions } from "../src/lib/problems/definitions";
import { behavioralQuestions } from "../src/lib/data/behavioral";
import { interviewModules } from "../src/lib/interview/modules";
test("Verified NeetCode curriculum has 150 unique entries and the expected distribution", () => {
  assert.equal(problems.length, 150); assert.equal(new Set(problems.map(p => p.id)).size, 150);
  assert.equal(topics.length, 18);
  assert.deepEqual(["Easy", "Medium", "Hard"].map(d => problems.filter(p => p.difficulty === d).length), [28, 101, 21]);
  assert.equal(problems.filter(p => p.topic === "Stack").length, 6);
  assert.equal(problems.filter(p => p.topic === "Backtracking").length, 10);
  assert.ok(problems.every(p => p.sourceUrl === `https://leetcode.com/problems/${p.id}/`));
});
test("All 15 runnable definitions have examples and edge cases", () => {
  assert.equal(runnableProblems.length, 15);
  for (const p of runnableProblems) {const d = definitions[p.id]; assert.ok(d); assert.ok(d.tests.length >= 5); assert.equal(d.tests.filter(t => t.example).length, 2);}
});
test("Behavioral questions and module capabilities are independent of coding", () => {
  assert.equal(behavioralQuestions.length, 20);
  assert.equal(new Set(behavioralQuestions.map(q => q.id)).size, 20);
  assert.ok(interviewModules.coding.capabilities.includes("code"));
  assert.ok(!interviewModules.behavioral.capabilities.includes("code"));
  assert.equal(interviewModules.behavioral.questions.length, 20);
});
