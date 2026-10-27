"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Code2, ExternalLink, FileText, RotateCcw, Star, Terminal } from "lucide-react";
import { interviewQuestion } from "@/lib/problems/interview-questions";
import { codeWithStarter } from "@/lib/problems/starters";
import { draftKey, languages, type Attempt, type Language, type Problem, type ProgressStatus } from "@/lib/types";
import { useWorkspace } from "./workspace-provider";
import { Badge, DifficultyBadge, prettyLanguage, relativeDate } from "./ui";
import { CodeEditor } from "./code-editor";
import { ExecutionResults } from "./execution-results";

export function CodingWorkspace({problem, sessionId, initialLanguage, onContext, onVerify}: {problem: Problem; sessionId?: string; initialLanguage?: Language; onVerify?: () => Promise<void>; onContext?: (context: {code: string; language: Language; attempt?: Attempt}) => void}) {
  const {data, progressFor, mutate, notify} = useWorkspace();
  const question = interviewQuestion(problem.id);
  const starter = (language: Language) => question?.starters[language] || "";
  const [language, setLanguage] = useState<Language>(initialLanguage || "python");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const progress = progressFor(problem.id);
  const code = codeWithStarter(data.drafts[draftKey(problem.id, language)]?.code, starter(language), language);
  const attempts = useMemo(() => data.attempts.filter(a => a.problemId === problem.id && (!sessionId || a.sessionId === sessionId)), [data.attempts, problem.id, sessionId]);
  const latest = attempts.find(a => a.language === language);
  const onContextRef = useRef(onContext);
  onContextRef.current = onContext;
  useEffect(() => { onContextRef.current?.({code, language, attempt: latest}); }, [code, language, latest]);
  useEffect(() => {
    if (initialLanguage) return;
    const saved = localStorage.getItem(`interview-pal.language:${problem.id}`);
    if (languages.includes(saved as Language)) setLanguage(saved as Language);
  }, [initialLanguage, problem.id]);
  const updateCode = (value: string) => {
    mutate({kind: "draft", value: {problemId: problem.id, language, code: value, updatedAt: new Date().toISOString()}});
    if (progress.status === "not-started") mutate({kind: "progress", value: {...progress, status: "practicing", updatedAt: new Date().toISOString()}});
  };
  const requestVerification = async () => {
    setError(""); setSubmitting(true);
    try {await onVerify?.();} catch (error) {setError(error instanceof Error ? error.message : "Verification could not be requested.");}
    finally {setSubmitting(false);}
  };
  return <div className={sessionId ? "embedded-problem" : "standalone-problem"}>
    {!sessionId && <><Link href="/coding" className="breadcrumb-back"><ArrowLeft size={13}/>Back to coding practice</Link><div className="problem-header"><div><h1>{problem.title}</h1><div className="tag-row"><DifficultyBadge difficulty={problem.difficulty}/><Badge>{problem.topic}</Badge><Badge tone={problem.runnable ? "purple" : "neutral"}>Interview available</Badge></div></div><div className="button-row"><button className={`button button-secondary button-small ${progress.reviewLater ? "selected" : ""}`} onClick={() => mutate({kind: "progress", value: {...progress, reviewLater: !progress.reviewLater, updatedAt: new Date().toISOString()}})} aria-pressed={progress.reviewLater}><Star size={14} fill={progress.reviewLater ? "currentColor" : "none"}/>{progress.reviewLater ? "On review list" : "Review later"}</button><span className="problem-progress"><select aria-label="Problem progress" className="status-select" value={progress.status} onChange={e => mutate({kind: "progress", value: {...progress, status: e.target.value as ProgressStatus, updatedAt: new Date().toISOString()}})}><option value="not-started">Not started</option><option value="practicing">Practicing</option><option value="solved">Solved</option></select><ChevronDown size={14} aria-hidden="true"/></span></div></div></>}
    {!question ? <div className="card"><div className="external-only"><BookOpen size={30}/><h2 style={{marginTop: 18}}>A place for your thinking.</h2><p>This question is in your curriculum. Solve it on LeetCode, then save your approach, tradeoffs, and lessons here. Keep your progress and notes here.</p><a href={problem.sourceUrl} target="_blank" rel="noreferrer" className="button button-primary">Open on LeetCode<ExternalLink size={14}/></a></div><div className="workspace-notes"><label htmlFor="problem-notes">Your notes</label><textarea id="problem-notes" value={progress.notes} onChange={e => mutate({kind: "progress", value: {...progress, notes: e.target.value, updatedAt: new Date().toISOString()}})} placeholder="What was the key insight? Which edge cases mattered?"/></div></div> : <div className="workspace-grid">
      <section className="card problem-panel"><div className="panel-heading"><span><FileText size={14}/>Problem</span><a className="text-link" href={problem.sourceUrl} target="_blank" rel="noreferrer">Open on LeetCode<ExternalLink size={11}/></a></div><div className="panel-body problem-prompt"><p>{question.prompt}</p><h3>Examples</h3>{question.examples.map((test, i) => <div className="example" key={i}><strong>Example {i + 1}</strong><code>Input: {test.input}</code><code>Output: {test.output}</code></div>)}<h3>Constraints</h3><ul className="constraints">{question.constraints.map(c => <li key={c}>{c}</li>)}</ul><p className="field-hint">Practice on LeetCode. This authored prompt is for Interview Pal sessions; requirements may differ from LeetCode.</p></div>{!sessionId && <div className="workspace-notes"><label htmlFor="problem-notes">Your notes</label><textarea id="problem-notes" value={progress.notes} onChange={e => mutate({kind: "progress", value: {...progress, notes: e.target.value, updatedAt: new Date().toISOString()}})} placeholder="Capture your approach, complexity, and what you learned…"/></div>}</section>
      <div><section className="card editor-panel"><div className="editor-toolbar"><span style={{display: "flex", gap: 7, alignItems: "center", fontSize: 11}}><Code2 size={14}/>Your solution</span><select aria-label="Coding language" value={language} onChange={e => {setLanguage(e.target.value as Language); setError(""); setResetConfirm(false); localStorage.setItem(`interview-pal.language:${problem.id}`, e.target.value);}}>{languages.map(l => <option key={l} value={l}>{prettyLanguage(l)}</option>)}</select></div><CodeEditor value={code} language={language} onChange={updateCode}/><div className="editor-actions"><button className="button button-ghost button-small" onClick={() => {if (resetConfirm) {updateCode(starter(language)); setResetConfirm(false); notify("Starter code restored");} else setResetConfirm(true);}}><RotateCcw size={13}/>{resetConfirm ? "Confirm reset" : "Reset starter"}</button><div className="button-row"><a className="button button-secondary button-small" href={problem.sourceUrl} target="_blank" rel="noreferrer">Practice on LeetCode<ExternalLink size={12}/></a>{sessionId && <button className="button button-primary button-small" disabled={submitting || !onVerify} onClick={() => void requestVerification()}>{submitting ? "Requesting assessment…" : "Ask interviewer to judge"}</button>}</div></div></section>
      {error && <div className="inline-alert" role="alert">{error}</div>}
      {sessionId && <section className="card test-panel"><div className="panel-heading"><span><Terminal size={14}/>Solution assessment</span><Badge>{latest && !latest.result.assessment ? "Historical test results" : "OpenAI judge"}</Badge></div><p className="run-hint">{"The interviewer judges your solution. Python can run AI-selected cases; JavaScript and TypeScript receive a reasoning review. These assessments are not LeetCode acceptance."}</p>{latest && latest.code !== code && <p className="run-hint">These results belong to an earlier code snapshot.</p>}<ExecutionResults result={latest?.result} pending={submitting}/></section>}
      {attempts.length > 0 && <section className="card attempt-list"><div className="panel-heading"><span>Saved attempts</span><Badge>{attempts.length}</Badge></div>{attempts.slice(0, 5).map(attempt => <div className="attempt-row" key={attempt.id}><div><Badge tone={attempt.result.status === "passed" ? "green" : attempt.result.status === "failed" || attempt.result.status === "error" || attempt.result.status === "timeout" ? "red" : "amber"}>{attempt.result.status}</Badge><span> · {prettyLanguage(attempt.language)} · {relativeDate(attempt.createdAt)}</span></div><button className="text-link" onClick={() => {setLanguage(attempt.language); mutate({kind: "draft", value: {problemId: problem.id, language: attempt.language, code: attempt.code, updatedAt: new Date().toISOString()}}); notify("Saved attempt restored to the editor");}}>Restore code</button></div>)}</section>}
      </div>
    </div>}
    {!sessionId && <div className="workspace-bottom"><span className="field-hint">Practice and run tests on LeetCode. Optional drafts and notes are saved here.</span>{question && <Link className="text-link" href={`/interviews?type=coding&question=${problem.id}`}>Practice this in an interview<ArrowRight size={13}/></Link>}</div>}
  </div>;
}
