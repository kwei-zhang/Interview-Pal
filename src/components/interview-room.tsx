"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, AudioLines, Clock3, FileText, Mic, MicOff, Send, Square, Volume2, VolumeX } from "lucide-react";
import { problemById } from "@/lib/data/catalog";
import { questionById } from "@/lib/data/behavioral";
import { OpenAIInterviewAgent } from "@/lib/interview/openai-agent";
import type { InterviewAgentAdapter } from "@/lib/interview/agent";
import type { Attempt, InterviewSession, Language } from "@/lib/types";
import { useWorkspace } from "./workspace-provider";
import { Badge, EmptyState } from "./ui";
import { CodingWorkspace } from "./coding-workspace";

function formatTime(seconds: number) {return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;}
export function InterviewRoom({id}: {id: string}) {
  const router = useRouter();
  const {data, mutate, flush, addAttempt, accountFetch} = useWorkspace();
  const flushRef = useRef(flush); flushRef.current = flush;
  const session = data.sessions.find(s => s.id === id);
  const sessionRef = useRef(session); sessionRef.current = session;
  const adapterRef = useRef<InterviewAgentAdapter | null>(null);
  const [interviewerState, setInterviewerState] = useState("connecting");
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(soundOn); soundRef.current = soundOn;
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [liveVoice, setLiveVoice] = useState(false);
  const [caption, setCaption] = useState("");
  const [elapsed, setElapsed] = useState(session?.elapsedSeconds || 0);
  const elapsedRef = useRef(elapsed); elapsedRef.current = elapsed;
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const contextRef = useRef<{code: string; language?: Language; attempt?: Attempt}>({code: ""});
  const updateSession = useCallback((next: InterviewSession) => {sessionRef.current = next; mutate({kind: "session", value: next});}, [mutate]);
  useEffect(() => {
    const current = sessionRef.current;
    if (!current || current.status === "completed") return;
    const adapter: InterviewAgentAdapter = new OpenAIInterviewAgent(accountFetch); adapterRef.current = adapter;
    let active = true;
    setError(""); setCaption(""); setLiveVoice(false);
    setVoiceAvailable(adapter.voice.available);
    adapter.voice.setMuted?.(!soundRef.current);
    updateSession({...current, adapter: "agent", feedback: current.adapter === "mock" ? undefined : current.feedback, status: "active", lastActiveAt: new Date().toISOString()});
    const unsubscribe = adapter.subscribe(event => {
      const latest = sessionRef.current;
      if (!latest || latest.id !== current.id || latest.status === "completed") return;
      if (event.type === "transcript") {
        if (!latest.transcript.some(t => t.id === event.event.id)) updateSession({...latest, transcript: [...latest.transcript, event.event], elapsedSeconds: elapsedRef.current, lastActiveAt: new Date().toISOString()});
        if (event.event.role === "interviewer" && soundRef.current) adapter.voice.speak(event.event.text);
      } else if (event.type === "feedback") updateSession({...latest, feedback: event.feedback, elapsedSeconds: elapsedRef.current, lastActiveAt: new Date().toISOString()});
      else if (event.type === "interviewer-state") setInterviewerState(event.state);
      else if (event.type === "verification") addAttempt(event.attempt);
      else if (event.type === "caption") setCaption(event.text);
      else if (event.type === "voice-connection") setLiveVoice(event.connected);
      else setError(event.message);
    });
    adapter.updateContext?.({code: contextRef.current.code, language: contextRef.current.language, testResults: contextRef.current.attempt?.result, testedCode: contextRef.current.attempt?.code, testedLanguage: contextRef.current.attempt?.language});
    void (async () => {
      await adapter.startSession(sessionRef.current!);
      if (!active) return;
      if (!await flushRef.current()) {if (active) setError("Save your pending changes before connecting live voice."); return;}
      if (active && sessionRef.current?.status === "active") adapter.connectVoice(setListening, setError);
    })().catch(error => {if (active) {setError(error instanceof Error ? error.message : "The interviewer could not connect."); setInterviewerState("disconnected");}});
    return () => {active = false; adapter.dispose(); unsubscribe(); if (adapterRef.current === adapter) adapterRef.current = null;};
  }, [id, updateSession, addAttempt, accountFetch]);
  useEffect(() => {
    const current = sessionRef.current;
    if (!current || current.status === "completed") return;
    const started = Date.now(), base = current.elapsedSeconds || 0;
    const timer = setInterval(() => {
      const next = Math.min(86400, base + Math.floor((Date.now() - started) / 1000));
      setElapsed(next); elapsedRef.current = next;
      const latest = sessionRef.current;
      if (latest?.status === "active" && next % 10 === 0) updateSession({...latest, elapsedSeconds: next, lastActiveAt: new Date().toISOString()});
    }, 1000);
    const pause = () => {
      const latest = sessionRef.current;
      if (latest?.status === "active") updateSession({...latest, status: "interrupted", elapsedSeconds: elapsedRef.current, lastActiveAt: new Date().toISOString()});
      adapterRef.current?.voice.stopListening(); adapterRef.current?.voice.stopSpeaking(); adapterRef.current?.voice.disconnect?.();
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (link && link.target !== "_blank" && new URL(link.href).pathname !== `/interviews/${id}`) pause();
    };
    window.addEventListener("pagehide", pause, {capture: true}); document.addEventListener("click", onClick, {capture: true});
    return () => {clearInterval(timer); window.removeEventListener("pagehide", pause, {capture: true}); document.removeEventListener("click", onClick, {capture: true});};
  }, [id, updateSession]);
  useEffect(() => {transcriptEnd.current?.scrollIntoView({block: "nearest"});}, [session?.transcript.length]);
  const finish = useCallback(async () => {
    if (finishing || !sessionRef.current || sessionRef.current.status === "completed") return;
    setFinishing(true); setError("");
    if (!await flush()) {setError("Save your pending changes before finishing the session."); setFinishing(false); return;}
    await adapterRef.current?.endSession();
    const latest = sessionRef.current!;
    updateSession({...latest, status: "completed", elapsedSeconds: elapsedRef.current, endedAt: new Date().toISOString(), lastActiveAt: new Date().toISOString()});
    if (!await flush()) {setError("Your review is ready, but it could not sync. Retry saving in the banner before leaving."); setFinishing(false); return;}
    router.push(`/history/${id}`);
  }, [finishing, updateSession, flush, router, id]);
  const finishRef = useRef(finish); finishRef.current = finish;
  useEffect(() => {if (session?.timed && session.status === "active" && elapsed >= session.durationMinutes * 60) void finishRef.current();}, [elapsed, session?.timed, session?.status, session?.durationMinutes]);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || sending || finishing || sessionRef.current?.status !== "active") return;
    if (!adapterRef.current) return;
    if (!await flush()) {setError("Save your pending changes before asking the interviewer a question."); return;}
    setSending(true); setError("");
    const text = input.trim(); setInput("");
    try {await adapterRef.current.sendInput({text, code: contextRef.current.code, language: contextRef.current.language, testResults: contextRef.current.attempt?.result, testedCode: contextRef.current.attempt?.code, testedLanguage: contextRef.current.attempt?.language});}
    catch (error) {setInput(text); setError(error instanceof Error ? error.message : "The interviewer could not receive your response. Please retry.");}
    finally {setSending(false);}
  };
  const toggleMic = async () => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    const voice = adapter.voice;
    if (listening) {voice.stopListening(); setListening(false); return;}
    try {
      if (sessionRef.current?.adapter === "agent" && !await flush()) {setError("Save your pending changes before connecting live voice."); return;}
      if (adapterRef.current === adapter && sessionRef.current?.status === "active") {setError(""); adapter.connectVoice(setListening, setError);}
    } catch {setError("Microphone access was not available. You can type your response below.");}
  };
  if (!session) return <EmptyState title="Session not found" description="This session may belong to another workspace or have been deleted." action={<Link href="/interviews" className="button button-primary">Start a session</Link>}/>;
  if (session.status === "completed") return <EmptyState icon={<AudioLines size={25}/>} title="Your session is complete" description={error || "Your transcript and review are saved."} action={<div className="button-row" style={{justifyContent: "center"}}><button className="button button-secondary" onClick={() => void flush()}>Retry saving</button><Link href={`/history/${id}`} className="button button-primary">Open review<ArrowRight size={14}/></Link></div>}/>;
  const problem = session.type === "coding" ? problemById(session.questionId) : undefined;
  const question = session.type === "behavioral" ? questionById(session.questionId) : undefined;
  const time = session.timed ? Math.max(0, session.durationMinutes * 60 - elapsed) : elapsed;
  return <>
    <Link href="/interviews" className="breadcrumb-back"><ArrowLeft size={13}/>Leave and save for later</Link>
    <div className="room-header"><div><h1>{problem?.title || "Your behavioral practice."}</h1><div className="tag-row"><Badge tone="purple">{session.type === "coding" ? "Coding" : "Behavioral"}</Badge><Badge>OpenAI interviewer</Badge><Badge>{session.timed ? "Timed interview" : "Untimed preparation"}</Badge></div></div><div className="session-controls"><span className={`timer ${session.timed && time < 60 ? "expiring" : ""}`}><Clock3 size={14}/>{formatTime(time)}<span style={{fontSize: 9}}>{session.timed ? "left" : "elapsed"}</span></span><button className="icon-button" aria-label={soundOn ? "Mute interviewer audio" : "Enable interviewer audio"} onClick={() => {setSoundOn(!soundOn); adapterRef.current?.voice.setMuted?.(soundOn); if (soundOn) adapterRef.current?.voice.stopSpeaking(); else {const last = session.transcript.filter(t => t.role === "interviewer").at(-1); if (last) adapterRef.current?.voice.speak(last.text);}}}>{soundOn ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button><button className="button button-secondary button-small" disabled={finishing} onClick={() => void finish()}><Square size={12}/>{finishing ? "Saving review…" : "Finish session"}</button></div></div>
    <div className="room-grid"><div>{problem ? <CodingWorkspace problem={problem} sessionId={session.id} initialLanguage={session.language} onVerify={async () => {
      if (!await flush()) throw new Error("Save your code before requesting verification.");
      if (!adapterRef.current || finishing) throw new Error("The interviewer is not ready.");
      await adapterRef.current.sendInput({text: "Please judge the code in my editor against the original problem.", code: contextRef.current.code, language: contextRef.current.language});
    }} onContext={context => {contextRef.current = context; adapterRef.current?.updateContext?.({code: context.code, language: context.language, testResults: context.attempt?.result, testedCode: context.attempt?.code, testedLanguage: context.attempt?.language});}}/> : <><section className="card behavioral-room-intro"><span className="eyebrow">YOUR OPENING QUESTION</span><Badge tone="purple">{question?.competency}</Badge><h2>{question?.question}</h2><p>Take a moment to think. Tell your story with clear context, your actions, and what happened as a result.</p></section><section className="card scratchpad"><div className="panel-heading"><span><FileText size={14}/>Your scratchpad</span><Badge>Private notes</Badge></div><div className="panel-body"><label className="sr-only" htmlFor="interview-scratchpad">Interview scratchpad</label><textarea id="interview-scratchpad" value={session.scratchpad} onChange={e => updateSession({...sessionRef.current!, scratchpad: e.target.value, lastActiveAt: new Date().toISOString()})} maxLength={20000} placeholder="Jot down keywords, facts, or a quick outline…"/></div></section><div className="card behavioral-room-tips" style={{marginTop: 18}}><h3 style={{color: "var(--text)"}}>Keep it grounded.</h3><ul><li>Explain what you were personally responsible for.</li><li>Describe the choices you made and why.</li><li>Include the outcome and what you learned.</li></ul></div></>}</div>
    <section className="card interviewer-panel"><div className="interviewer-portrait"><span className="interviewer-orb"><AudioLines size={21}/></span><div><strong>Your practice interviewer</strong><small><span className="status-dot"/>{interviewerState === "thinking" ? "Preparing a follow-up…" : interviewerState === "connecting" ? "Connecting…" : interviewerState === "disconnected" ? "Disconnected" : interviewerState === "listening" ? "Listening…" : interviewerState === "speaking" ? "Speaking…" : liveVoice ? "Live voice connected" : "AI chat ready · voice off"}</small></div></div><div className="transcript" role="log" aria-label="Interview transcript" aria-live="polite">{session.transcript.map(event => <div className={`transcript-message ${event.role}`} key={event.id}><div className="message-meta"><strong>{event.role === "candidate" ? "You" : "Interviewer"}</strong><span>{new Date(event.timestamp).toLocaleTimeString("en", {hour: "2-digit", minute: "2-digit"})}</span></div><p>{event.text}</p></div>)}{caption && <div className="transcript-message interviewer live-caption"><div className="message-meta"><strong>Interviewer · live</strong></div><p>{caption}</p></div>}<div ref={transcriptEnd}/></div><form className="candidate-input" onSubmit={event => void send(event)}><div className="textarea-label-row"><label htmlFor="candidate-response">Your response</label>{listening && <span className="recording-indicator"><i/>Listening</span>}</div><textarea id="candidate-response" placeholder="Ask about constraints, clarify an example, or explain your approach…" maxLength={10000} value={input} onChange={e => setInput(e.target.value)} disabled={sending || finishing}/><div className="button-row"><button type="button" className={`mic-button ${listening ? "listening" : ""}`} aria-label={listening ? "Stop microphone" : "Start microphone"} disabled={sending || finishing || !voiceAvailable} onClick={() => void toggleMic()}>{listening ? <MicOff size={14}/> : <Mic size={14}/>} {listening ? "Mute mic" : "Speak"}</button><button className="button button-primary button-small" disabled={!input.trim() || sending || finishing} type="submit"><Send size={12}/>{sending ? "Sending…" : "Send response"}</button></div>{error && <div className="inline-alert" role="alert">{error}</div>}</form><div className="room-demo-note">{liveVoice ? "Live voice responds automatically when you finish speaking. You can interrupt or mute your mic. " : "Live voice connects automatically. Use Speak to retry, or type and send a question. "}No raw audio is stored by Interview Pal. Voice and conversation context are sent to OpenAI.</div></section></div>
  </>;
}
