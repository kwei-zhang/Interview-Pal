import type { CandidateInput } from "./agent";
import type { InterviewSession } from "../types";

export function agentSession(session: InterviewSession): InterviewSession {
  // Notes and the story bank never enter the agent context. Preserve full history
  // in storage; bound the context sent to a model independently.
  let remaining = 32000;
  const transcript = session.transcript.slice(-80).reverse().flatMap(event => {
    if (remaining <= 0) return [];
    const text = event.text.slice(0, Math.min(4000, remaining)); remaining -= text.length;
    return [{...event, text}];
  }).reverse();
  return {...session, scratchpad: "", feedback: undefined, transcript, adapter: "agent"};
}
export function codeContext(input: Partial<CandidateInput>) {
  return {
    language: input.language,
    code: input.code?.slice(0, 12000),
    codeTruncated: (input.code?.length || 0) > 12000,
    testSummary: input.testResults ? JSON.stringify({
      status: input.testResults.status,
      matchesCurrentDraft: input.testedCode !== undefined && input.testedCode === input.code && input.testedLanguage === input.language,
      testedLanguage: input.testedLanguage,
      assessment: input.testResults.assessment,
      tests: input.testResults.tests.slice(0, 8).map(test => ({name: test.name, input: test.input, passed: test.passed, actual: test.actual, expected: test.expected, error: test.error?.slice(0, 300)})),
      error: input.testResults.error?.slice(0, 1000),
      runtimeMs: input.testResults.runtimeMs,
    }).slice(0, 4000) : undefined,
  };
}
