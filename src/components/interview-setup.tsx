"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, AudioLines, CheckCircle2, Code2, FileText, Info, Mic, Play, ShieldCheck } from "lucide-react";
import { interviewModules } from "@/lib/interview/modules";
import { BrowserVoiceTransport } from "@/lib/interview/browser-voice";
import { groupResumeProjects } from "@/lib/resume-projects";
import { sessionSchema } from "@/lib/validation";
import { languages, type InterviewSession, type InterviewType, type Language } from "@/lib/types";
import { useWorkspace } from "./workspace-provider";
import { Badge, PageHeading, prettyLanguage } from "./ui";
import { FormattedBullet } from "./formatted-bullet";
import styles from "./interview-setup.module.css";

export function InterviewSetup() {
  const router = useRouter();
  const {data, mutate, flush, accountFetch} = useWorkspace();
  const [type, setType] = useState<InterviewType>("coding");
  const [topic, setTopic] = useState("");
  const [questionId, setQuestionId] = useState(interviewModules.coding.questions[0].id);
  const [projectId, setProjectId] = useState("");
  const [language, setLanguage] = useState<Language>("python");
  const [duration, setDuration] = useState(45);
  const [timed, setTimed] = useState(true);
  const [mic, setMic] = useState<"unchecked" | "checking" | "ready" | "denied">("unchecked");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [agentConfigured, setAgentConfigured] = useState(false);
  const [checkingAgent, setCheckingAgent] = useState(true);
  const projects = groupResumeProjects(data.resumeBullets);
  const selectedProjectId = projectId || projects[0]?.id || "";
  const selectedProject = projects.find(project => project.id === selectedProjectId);
  useEffect(() => {
    let active = true;
    accountFetch("/api/config").then(r => r.json()).then(body => {
      if (active) setAgentConfigured(Boolean(body.agentConfigured));
    }).catch(() => {}).finally(() => {if (active) setCheckingAgent(false);});
    return () => {active = false;};
  }, [accountFetch]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("type");
    const selected: InterviewType = requested === "behavioral" || requested === "project" ? requested : "coding";
    setType(selected); setDuration(interviewModules[selected].defaultDuration);
    const id = params.get("question");
    setQuestionId(interviewModules[selected].questions.some(q => q.id === id) ? id! : interviewModules[selected].questions[0].id);
    setProjectId(params.get("project") || "");
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
    if (type === "project" && !selectedProject) {setError("Choose a saved project before starting an interview."); return;}
    setError("");
    const now = new Date().toISOString();
    const session: InterviewSession = {id: crypto.randomUUID(), type, roleId: module.roleId, questionId, durationMinutes: duration, timed, language, status: "active", startedAt: now, lastActiveAt: now, elapsedSeconds: 0, scratchpad: "", transcript: [], adapter: "agent",
      ...(type === "project" && selectedProject ? {project: {id: selectedProject.id, name: selectedProject.name || "Untitled project", bullets: selectedProject.bullets.map(bullet => bullet.text)}} : {})};
    const parsed = sessionSchema.safeParse(session);
    if (!parsed.success) {setError(parsed.error.issues[0].message); return;}
    setStarting(true);
    mutate({kind: "session", value: parsed.data});
    if (!await flush()) {setError("The session could not be synced. Retry saving before entering the interview."); setStarting(false); return;}
    router.push(`/interviews/${session.id}`);
  };
  return <>
    <PageHeading eyebrow="A SPACE TO THINK OUT LOUD" title="Meet your next practice session." description="Choose your focus, take a breath, and practice at your own pace."/>
    <div className="setup-columns"><section className="card card-padding"><form onSubmit={event => void start(event)}>
      <h2 style={{marginBottom: 18}}>What would you like to practice?</h2>
      <div className={`interview-type-grid ${styles.types}`}>{(["coding", "behavioral", "project"] as const).map(value => <button className={`type-card ${type === value ? "selected" : ""}`} type="button" aria-pressed={type === value} key={value} onClick={() => {setType(value); setDuration(interviewModules[value].defaultDuration); setQuestionId(interviewModules[value].questions[0].id); setTopic(""); setError("");}}>
        {value === "coding" ? <Code2 size={22}/> : value === "project" ? <FileText size={22}/> : <AudioLines size={22}/>}<span className="selection-dot"/><strong>{interviewModules[value].title}</strong><p>{interviewModules[value].description}</p>
      </button>)}</div>
      <div className="form-grid">
        {type !== "project" && <div><label htmlFor="session-topic">Focus area</label><select id="session-topic" value={topic} onChange={e => {setTopic(e.target.value); setQuestionId(module.questions.find(q => !e.target.value || q.topic === e.target.value)!.id);}}><option value="">All {type === "coding" ? "topics" : "competencies"}</option>{[...new Set(module.questions.map(q => q.topic))].map(t => <option key={t}>{t}</option>)}</select></div>}
        <div><label htmlFor="session-duration">Session length</label><select id="session-duration" value={duration} disabled={!timed} onChange={e => setDuration(Number(e.target.value))}>{[5, 15, 30, 45, 60, 90].map(value => <option value={value} key={value}>{value} minutes</option>)}</select></div>
        {type === "project" ? <div className="field-full">
          {projects.length ? <><label htmlFor="session-project">Project</label><select id="session-project" required value={selectedProject ? selectedProjectId : ""} onChange={event => {setProjectId(event.target.value); setError("");}}><option value="" disabled>Choose a project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name || "Untitled project"}</option>)}</select>
            {!selectedProject && <p className="form-error" role="alert">This project is no longer available. Choose another project.</p>}
            {selectedProject && <div className={styles.projectPreview}><h3>Resume points shared with your interviewer</h3><ul>{selectedProject.bullets.map(bullet => <li key={bullet.id}><FormattedBullet text={bullet.text}/></li>)}</ul></div>}
            <p className="field-hint">Your interviewer will use this project's saved bullet points. <Link href="/project-interview" className="text-link">Manage projects</Link></p>
          </> : <div className={styles.projectEmpty}><h3>Add a project to get started</h3><p>Save a project and its resume bullet points in Project prep, then return here for an interview.</p><Link href="/project-interview" className="button button-secondary">Go to Project prep<ArrowRight size={14}/></Link></div>}
        </div> : <div className="field-full"><label htmlFor="session-question">{type === "coding" ? "Problem" : "Opening question"}</label><select id="session-question" value={questionId} onChange={e => setQuestionId(e.target.value)}>{available.map(q => <option value={q.id} key={q.id}>{q.title}</option>)}</select><p className="field-hint">{type === "coding" ? "Choose any of the LeetCode Top Interview 150 problems. All have starter code and LLM judging. Python can be executed with AI-selected cases." : "Follow-up questions help you practice the details behind your story."}</p></div>}
        {type === "coding" && <div><label htmlFor="session-language">Coding language</label><select id="session-language" value={language} onChange={e => setLanguage(e.target.value as Language)}>{languages.map(l => <option value={l} key={l}>{prettyLanguage(l)}</option>)}</select></div>}
        <div style={{alignSelf: "center"}}><label className="filter-check"><input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)}/>Timed interview</label><p className="field-hint">Turn off for untimed preparation.</p></div>
      </div>
      <hr/><div className="button-row" style={{justifyContent: "space-between"}}><div><button type="button" className="button button-secondary" onClick={() => void checkMic()} disabled={mic === "checking"}>{mic === "ready" ? <CheckCircle2 size={14}/> : <Mic size={14}/>} {mic === "ready" ? "Microphone ready" : mic === "checking" ? "Checking…" : "Check microphone"}</button><p className="field-hint">Permission check only. No audio is stored.</p></div><button type="submit" className="button button-primary button-large" disabled={starting || checkingAgent || !agentConfigured || (type === "project" && !selectedProject)}><Play size={13} fill="currentColor"/>{starting ? "Preparing…" : "Enter practice room"}<ArrowRight size={14}/></button></div>
      {error && <div className="inline-alert" role="alert">{error}</div>}
    </form></section>
    <div><section className="card card-padding"><Badge tone={agentConfigured ? "purple" : "neutral"}>{checkingAgent ? "Checking OpenAI connection…" : agentConfigured ? "OpenAI interviewer" : "OpenAI not connected"}</Badge><h2 style={{marginTop: 15}}>Practice the whole conversation.</h2><ol className="step-list"><li><span className="step-number">1</span><div><strong>Get comfortable</strong><p>Talk with live voice, or type questions and answers when you prefer.</p></div></li><li><span className="step-number">2</span><div><strong>Work through the details</strong><p>{type === "project" ? "Discuss your project, explain technical tradeoffs, and answer follow-ups about your contribution." : "Explain your reasoning, answer follow-ups, and use the editor or scratchpad."}</p></div></li><li><span className="step-number">3</span><div><strong>Reflect and improve</strong><p>Revisit your transcript, saved work, and next practice steps.</p></div></li></ol><div className="info-box" style={{marginTop: 18}}><Info size={15}/><span>{agentConfigured ? "Live voice and recording start automatically when you enter. Allow microphone access if your browser asks, or continue with typed responses. Voice recording cannot be turned off; you can still mute your microphone." : checkingAgent ? "Checking that your interviewer is ready." : <>Connect OpenAI in <Link href="/settings" className="text-link">Settings</Link> before starting an interview.</>}</span></div><p className="field-hint" style={{marginTop: 12, display: "flex", gap: 6, alignItems: "center"}}><ShieldCheck size={12}/>{type === "project" ? "Only the selected project is shared. Your scratchpad stays private." : "Your story bank stays out of the interview room."}</p></section>
      {activeSessions.length > 0 && <section className="card card-padding" style={{marginTop: 20}}><h3>Pick up a previous session</h3>{activeSessions.map(s => <Link className="session-mini" key={s.id} href={`/interviews/${s.id}`}><div><h3>{interviewModules[s.type].title}</h3><p>{s.type === "project" ? `${s.project?.name} · ` : ""}{s.transcript.length} transcript entries saved</p></div><ArrowRight size={14}/></Link>)}</section>}
    </div></div>
  </>;
}
