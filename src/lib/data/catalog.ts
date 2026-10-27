import seed from "./top-interview-150.json";
import previousSeed from "./neetcode150.json";
import type { Problem } from "../types";

export const codingCollection = {
  id: "top-interview-150",
  name: "LeetCode Top Interview 150",
  sourceUrl: "https://leetcode.com/studyplan/top-interview-150/",
};

// Official study-plan order, topics, titles, and difficulty, verified 2026-10-27.
export const problems: Problem[] = seed.map(p => ({...p, difficulty: p.difficulty as Problem["difficulty"], collectionId: codingCollection.id, runnable: true}));
// Keep old links, saved sessions, notes, and drafts accessible without including
// retired questions in the active curriculum or its progress totals.
export const archivedProblems: Problem[] = previousSeed.filter(p => !problems.some(current => current.id === p.id)).map(p => ({...p, topic: p.id === "generate-parentheses" ? "Backtracking" : p.topic, difficulty: p.difficulty as Problem["difficulty"], collectionId: "neetcode-150", runnable: true}));
export const topics = [...new Set(problems.map(p => p.topic))];
export const problemById = (id: string) => problems.find(p => p.id === id) ?? archivedProblems.find(p => p.id === id);
