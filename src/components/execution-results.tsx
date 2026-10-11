"use client";

import { CheckCircle2, CircleX, LoaderCircle, Terminal, AlertCircle } from "lucide-react";
import type { ExecutionResult } from "@/lib/types";
import { Badge } from "./ui";

export function ExecutionResults({result, pending = false}: {result?: ExecutionResult; pending?: boolean}) {
  if (pending || result?.status === "queued" || result?.status === "running") return <div className="run-hint" role="status"><LoaderCircle className="spin" size={16}/>Verification is pending. Your code snapshot is saved.</div>;
  if (!result) return <div className="run-hint"><Terminal size={17}/><span>No executed verification yet. Ask the interviewer to check your Python solution.</span></div>;
  return <><div className="result-summary"><span><Badge tone={result.status === "passed" ? "green" : "red"}>{result.status === "passed" ? "Passed" : result.status === "failed" ? "Some tests failed" : result.status === "timeout" ? "Time limit exceeded" : "Execution error"}</Badge> {result.tests.length > 0 && `${result.tests.filter(t => t.passed).length} / ${result.tests.length} tests`}</span><small>{result.runtimeMs !== undefined && `${Math.round(result.runtimeMs)} ms`}{result.memoryKb !== undefined && ` · ${Math.round(result.memoryKb / 1024)} MB`}</small></div>{result.error && <div className="inline-alert" role="alert" style={{margin: 12}}><AlertCircle size={13} style={{display: "inline", marginRight: 5}}/>{result.error}</div>}{result.tests.map((test, i) => <details className={`test-result ${test.passed ? "" : "failed"}`} key={i}><summary>{test.passed ? <CheckCircle2 size={14}/> : <CircleX size={14}/>}<span>{test.name}</span><span className="muted" style={{marginLeft: "auto", fontSize: 9}}>Details</span></summary><pre>Expected: {JSON.stringify(test.expected)}{"\n"}{test.error ? `Error: ${test.error}` : `Actual: ${JSON.stringify(test.actual)}`}</pre></details>)}{result.stdout && <details className="test-result"><summary><Terminal size={14}/>Program output</summary><pre>{result.stdout}</pre></details>}</>;
}
