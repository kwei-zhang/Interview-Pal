"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, AudioLines, BookOpen, CalendarDays, CheckCircle2, Code2, Flame, Lightbulb, Play, Sparkles, Star, Target } from "lucide-react";
import { problems, runnableProblems, topics, problemById } from "@/lib/data/catalog";
import { useWorkspace } from "./workspace-provider";
import { Badge, DifficultyBadge, EmptyState, PageHeading, SectionTitle, relativeDate } from "./ui";

export function Dashboard() {
  const {data, progressFor} = useWorkspace();
  const solved = problems.filter(p => progressFor(p.id).status === "solved").length;
  const reviews = problems.filter(p => progressFor(p.id).reviewLater);
  const completed = data.sessions.filter(s => s.status === "completed");
  const weekAgo = Date.now() - 7 * 86400000;
  const weekCount = completed.filter(s => Date.parse(s.startedAt) > weekAgo).length + problems.filter(p => data.progress[p.id]?.status === "solved" && Date.parse(data.progress[p.id].updatedAt) > weekAgo).length;
  const next = runnableProblems.find(p => progressFor(p.id).status === "practicing") || runnableProblems.find(p => progressFor(p.id).status !== "solved") || runnableProblems[0];
  const recent = data.sessions.slice(0, 3);
  const focusTopics = [...topics].sort((a, b) => problems.filter(p => p.topic === b && progressFor(p.id).status === "solved").length - problems.filter(p => p.topic === a && progressFor(p.id).status === "solved").length).slice(0, 5);
  const metrics = [
    {label: "Problems solved", value: solved, suffix: "/ 150", note: "Your NeetCode 150 journey", icon: Code2},
    {label: "Stories in your bank", value: data.stories.length, suffix: "stories", note: "Experience worth sharing", icon: BookOpen},
    {label: "Interviews completed", value: completed.length, suffix: "sessions", note: "Practice builds confidence", icon: AudioLines},
    {label: "Weekly practice", value: weekCount, suffix: `/ ${data.profile.weeklyGoal}`, note: "Solved problems + completed sessions", icon: Flame},
  ];
  return <>
    <PageHeading eyebrow="YOUR PERSONAL PRACTICE SPACE" title={data.profile.displayName ? `Welcome back, ${data.profile.displayName.split(" ")[0]}.` : "A little practice. A lot more confidence."} description="Build your skills, find your stories, and get ready for what’s next." action={<div className="landing-date"><CalendarDays size={15}/>{new Date().toLocaleDateString("en", {weekday: "short", month: "short", day: "numeric"})}</div>}/>
    <section className="hero"><div><span className="eyebrow">ONE SESSION CLOSER</span><h2>Make your next interview<br/><em>your best one.</em></h2><p>Practice thinking out loud, writing better code, and telling the stories only you can tell.</p><div className="button-row"><Link href="/interviews" className="button button-primary"><Play size={13} fill="currentColor"/>Start a mock interview<ArrowRight size={14}/></Link><Link href="/coding" className="button button-ghost">Explore your practice<ArrowUpRight size={13}/></Link></div></div><div className="hero-art" aria-hidden="true"><div className="orbit"/><div className="hero-code"><div className="code-dots"><i/><i/><i/></div><code><span>function</span> yourNextStep() &#123;<br/>&nbsp; practice.<span>think</span>();<br/>&nbsp; practice.<span>build</span>();<br/>&nbsp; practice.<span>explain</span>();<br/>&#125;</code></div><div className="hero-voice"><div className="waveform">{[8, 15, 25, 18, 30, 20, 12, 23, 16, 7, 14, 6].map((height, i) => <i key={i} style={{height}}/>)}</div><p>Your story. Your voice.</p></div><Sparkles className="art-spark" size={20}/></div></section>
    <div className="metrics-grid">{metrics.map(({label, value, suffix, note, icon: Icon}) => <div className="card metric-card" key={label}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={14}/></span></div><div className="metric-value">{value}<span>{suffix}</span></div><div className="metric-note">{note}</div></div>)}</div>
    <div className="dashboard-columns">
      <section className="card card-padding"><SectionTitle title="Your next steps" subtitle="A focused place to pick up where you left off."/>
        <div className="focus-item"><span className="focus-icon"><Code2 size={18}/></span><div><h3>{next.title}</h3><p>{progressFor(next.id).status === "practicing" ? "Continue your LeetCode practice" : "Warm up with a coding problem"}</p><div className="tag-row"><DifficultyBadge difficulty={next.difficulty}/><Badge>{next.topic}</Badge></div></div><Link href={`/coding/${next.id}`} className="icon-button" aria-label={`Practice ${next.title}`}><ArrowUpRight size={17}/></Link></div>
        <div className="focus-item"><span className="focus-icon"><BookOpen size={18}/></span><div><h3>{data.stories.length ? "Make your story more memorable" : "Find your first interview story"}</h3><p>{data.stories.length ? "Review a story and connect it to behavioral questions" : "Start with a moment when you made a difference"}</p><Badge tone="purple">Behavioral preparation</Badge></div><Link href="/behavioral" className="icon-button" aria-label="Open behavioral preparation"><ArrowUpRight size={17}/></Link></div>
        <div className="focus-item"><span className="focus-icon"><Star size={18}/></span><div><h3>{reviews.length ? `${reviews.length} ${reviews.length === 1 ? "problem" : "problems"} to revisit` : "Keep the tricky ones close"}</h3><p>{reviews.length ? reviews.slice(0, 2).map(p => p.title).join(" · ") : "Star a problem to add it to your review list"}</p><Badge tone="amber">Review later</Badge></div><Link href="/coding?review=true" className="icon-button" aria-label="View problems marked for review"><ArrowUpRight size={17}/></Link></div>
      </section>
      <section className="card card-padding"><SectionTitle title="Your coding journey" href="/coding" linkLabel="Explore"/>
        <div className="overall-progress"><div className="progress-ring"><svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--surface-soft)" strokeWidth="6"/><circle cx="40" cy="40" r="34" fill="none" stroke="var(--purple)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${solved / 150 * 213.6} 213.6`}/></svg><div className="progress-ring-label"><strong>{Math.round(solved / 150 * 100)}%</strong><small>complete</small></div></div><div><h3>NeetCode 150</h3><p>{solved} solved · {150 - solved} opportunities</p><Badge tone="purple">18 topic areas</Badge></div></div>
        {focusTopics.map(topic => {const list = problems.filter(p => p.topic === topic), count = list.filter(p => progressFor(p.id).status === "solved").length; return <div className="topic-progress" key={topic}><strong>{topic}</strong><div className="progress-track"><i style={{width: `${count / list.length * 100}%`}}/></div><span>{count}/{list.length}</span></div>;})}
        <p className="progress-caption"><CheckCircle2 size={11} style={{display: "inline", marginRight: 5}}/>Progress follows the problems you mark as solved.</p>
      </section>
    </div>
    <section className="card card-padding"><SectionTitle title="Recent practice sessions" subtitle="Every conversation is a chance to improve." href="/history"/>{recent.length ? recent.map(session => <Link className="session-mini" href={session.status === "completed" ? `/history/${session.id}` : `/interviews/${session.id}`} key={session.id}><span className="focus-icon">{session.type === "coding" ? <Code2 size={17}/> : <AudioLines size={17}/>}</span><div><h3>{session.type === "coding" ? problemById(session.questionId)?.title : "Behavioral interview"}</h3><p>{relativeDate(session.startedAt)} · {session.type === "coding" ? "Coding" : "Behavioral"} · {session.durationMinutes} min</p></div><Badge tone={session.status === "completed" ? "green" : "amber"}>{session.status === "completed" ? "Completed" : "Resume practice"}</Badge><ArrowUpRight size={16}/></Link>) : <EmptyState icon={<AudioLines size={22}/>} title="Your first session starts here" description="Practice a conversation, then revisit your transcript and saved work." action={<Link href="/interviews" className="button button-secondary">Start a session<ArrowRight size={14}/></Link>}/>}</section>
    <div className="tip-card"><Lightbulb size={20}/><div><h3>Practice the explanation, too.</h3><p>A correct answer is a start. Explain your assumptions, tradeoffs, and reasoning as you work.</p></div><Target size={19} style={{marginLeft: "auto", color: "var(--muted)"}}/></div>
  </>;
}
