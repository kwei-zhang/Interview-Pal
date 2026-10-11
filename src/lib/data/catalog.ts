import seed from "./neetcode150.json";
import { definitions } from "../problems/definitions";
import type { Problem } from "../types";

export const problems: Problem[] = seed.map(p => ({...p, topic: p.id === "generate-parentheses" ? "Backtracking" : p.topic, difficulty: p.difficulty as Problem["difficulty"], collectionId: "neetcode-150", runnable: Boolean(definitions[p.id])}));
export const topics = [...new Set(problems.map(p => p.topic))];
export const runnableProblems = problems.filter(p => p.runnable);
export const problemById = (id: string) => problems.find(p => p.id === id);
