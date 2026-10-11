"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, AudioLines, CheckCircle2, Code2, Info, Mic, Play, ShieldCheck } from "lucide-react";
import { interviewModules } from "@/lib/interview/modules";
import { BrowserVoiceTransport } from "@/lib/interview/browser-voice";
import { languages, type InterviewSession, type InterviewType, type Language } from "@/lib/types";
import { useWorkspace } from "./workspace-provider";
import { Badge, PageHeading, prettyLanguage } from "./ui";

export function InterviewSetup() {
  const router = useRouter();
  const {data, mutate, flush} = useWorkspace();
  const [type, setType] = useState<InterviewType>("coding");
  const [topic, setTopic] = useState("");
  const [questionId, setQuestionId] = useState(interviewModules.coding.questions[0].id);
  const [language, setLanguage] = useState<Language>("python");
  const [duration, setDuration] = useState(45);
  const [timed, setTimed] = useState(true);
  const [mic, setMic] = useState<"unchecked" | "checking" | "ready" | "denied">("unchecked");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [agentConfigured, setAgentConfigured] = useState(false);
  const [checkingAgent, setCheckingAgent] = useState(true);
  useEffect(() => {
    let active = true;
    fetch("/api/config").then(r => r.json()).then(body => {
      if (active) setAgentConfigured(Boolean(body.agentConfigured));
    }).catch(() => {}).finally(() => {if (active) setCheckingAgent(false);});
    return () => {active = false;};
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selected: InterviewType = params.get("type") === "behavioral" ? "behavioral" : "coding";
    setType(selected); setDuration(interviewModules[selected].defaultDuration);
    const id = params.get("question");
    setQuestionId(interviewModules[selected].questions.some(q => q.id === id) ? id! : interviewModules[selected].questions[0].id);
    setTimed(params.get("timed") !== "false");
  }, []);
  const module = interviewModules[type];
  const available = module.questions.filter(q => !topic || q.topic === topic);
  const activeSessions = data.sessions.filter(s => s.status !== "completed").slice(0, 2);
  const checkMic = async () => {
    setMic("checking"); setError("");
    const voice = new BrowserVoiceTransport();
    try {await voice.checkMicrophone(); setMic("ready");}
    catch {setMic("denied"); setError("Microphone access was not available. You can allow it in your browser or start with typed responses.");}
    finally {voice.dispose();}
  };
  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!agentConfigured) {setError("Connect OpenAI before starting an interview."); return;}
    setStarting(true); setError("");
    const now = new Date().toISOString();
    const session: InterviewSession = {id: crypto.randomUUID(), type, roleId: module.roleId, questionId, durationMinutes: duration, timed, language, status: "active", startedAt: now, lastActiveAt: now, elapsedSeconds: 0, scratchpad: "", transcript: [], adapter: "agent"};
    mutate({kind: "session", value: session});
    if (!await flush()) {setError("The session could not be synced. Retry saving before entering the interview."); setStarting(false); return;}
    router.push(`/interviews/${session.id}`);
  };
  return <>
    <PageHeading eyebrow="A SPACE TO THINK OUT LOUD" title="Meet your next practice session." description="Choose your focus, take a breath, and practice at your own pace."/>
    <div className="setup-columns"><section className="card card-padding"><form onSubmit={event => void start(event)}><h2 style={{marginBottom: 18}}>What would you like to practice?</h2><div className="interview-type-grid">{(["coding", "behavioral"] as InterviewType[]).map(value => <button className={`type-card ${type === value ? "selected" : ""}`} type="button" aria-pressed={type === value} key={value} onClick={() => {setType(value); setDuration(interviewModules[value].defaultDuration); setQuestionId(interviewModules[value].questions[0].id); setTopic("");}}>{value === "coding" ? <Code2 size={22}/> : <AudioLines size={22}/>}<span className="selection-dot"/><strong>{interviewModules[value].title}</strong><p>{interviewModules[value].description}</p></button>)}</div><div className="form-grid"><div><label htmlFor="session-topic">Focus area</label><select id="session-topic" value={topic} onChange={e => {setTopic(e.target.value); setQuestionId(module.questions.find(q => !e.target.value || q.topic === e.target.value)!.id);}}><option value="">All {type === "coding" ? "topics" : "competencies"}</option>{[...new Set(module.questions.map(q => q.topic))].map(t => <option key={t}>{t}</option>)}</select></div><div><label htmlFor="session-duration">Session length</label><select id="session-duration" value={duration} disabled={!timed} onChange={e => setDuration(Number(e.target.value))}>{[5, 15, 30, 45, 60, 90].map(value => <option value={value} key={value}>{value} minutes</option>)}</select></div><div className="field-full"><label htmlFor="session-question">{type === "coding" ? "Problem" : "Opening question"}</label><select id="session-question" value={questionId} onChange={e => setQuestionId(e.target.value)}>{available.map(q => <option value={q.id} key={q.id}>{q.title}</option>)}</select><p className="field-hint">{type === "coding" ? "Choose any of the NeetCode 150 problems. All have starter code and LLM judging. Python can be executed with AI-selected cases." : "Follow-up questions help you practice the details behind your story."}</p></div>{type === "coding" && <div><label htmlFor="session-language">Coding language</label><select id="session-language" value={language} onChange={e => setLanguage(e.target.value as Language)}>{languages.map(l => <option value={l} key={l}>{prettyLanguage(l)}</option>)}</select></div>}<div style={{alignSelf: "center"}}><label className="filter-check"><input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)}/>Timed interview</label><p className="field-hint">Turn off for untimed preparation.</p></div></div><hr/><div className="button-row" style={{justifyContent: "space-between"}}><div><button type="button" className="button button-secondary" onClick={() => void checkMic()} disabled={mic === "checking"}>{mic === "ready" ? <CheckCircle2 size={14}/> : <Mic size={14}/>} {mic === "ready" ? "Microphone ready" : mic === "checking" ? "Checking…" : "Check microphone"}</button><p className="field-hint">Permission check only. No audio is stored.</p></div><button type="submit" className="button button-primary button-large" disabled={starting || checkingAgent || !agentConfigured}><Play size={13} fill="currentColor"/>{starting ? "Preparing…" : "Enter practice room"}<ArrowRight size={14}/></button></div>{error && <div className="inline-alert" role="alert">{error}</div>}</form></section>
    <div><section className="card card-padding"><Badge tone={agentConfigured ? "purple" : "neutral"}>{checkingAgent ? "Checking OpenAI connection…" : agentConfigured ? "OpenAI interviewer" : "OpenAI not connected"}</Badge><h2 style={{marginTop: 15}}>Practice the whole conversation.</h2><ol className="step-list"><li><span className="step-number">1</span><div><strong>Get comfortable</strong><p>Talk with live voice, or type questions and answers when you prefer.</p></div></li><li><span className="step-number">2</span><div><strong>Work through the details</strong><p>Explain your reasoning, answer follow-ups, and use the editor or scratchpad.</p></div></li><li><span className="step-number">3</span><div><strong>Reflect and improve</strong><p>Revisit your transcript, saved code, and next practice steps.</p></div></li></ol><div className="info-box" style={{marginTop: 18}}><Info size={15}/><span>{agentConfigured ? "The AI answers your questions using the problem specification and conversation. Live voice and your microphone connect automatically when you enter. Allow microphone access if your browser asks; you can mute it anytime." : checkingAgent ? "Checking that your interviewer is ready." : <>Connect OpenAI in <Link href="/settings" className="text-link">Settings</Link> before starting an interview.</>}</span></div><p className="field-hint" style={{marginTop: 12, display: "flex", gap: 6, alignItems: "center"}}><ShieldCheck size={12}/>Your story bank stays out of the interview room.</p></section>{activeSessions.length > 0 && <section className="card card-padding" style={{marginTop: 20}}><h3>Pick up a previous session</h3>{activeSessions.map(s => <Link className="session-mini" key={s.id} href={`/interviews/${s.id}`}><div><h3>{interviewModules[s.type].title}</h3><p>{s.transcript.length} transcript entries saved</p></div><ArrowRight size={14}/></Link>)}</section>}</div></div>
  </>;
}
