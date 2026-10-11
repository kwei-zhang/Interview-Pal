"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, AudioLines, BookOpen, Edit3, Plus, Search, Trash2, X } from "lucide-react";
import { behavioralQuestions } from "@/lib/data/behavioral";
import { competencies, type Competency, type Story } from "@/lib/types";
import { storySchema } from "@/lib/validation";
import { useWorkspace } from "./workspace-provider";
import { Badge, EmptyState, PageHeading, relativeDate } from "./ui";

function blankStory(questionId?: string): Story {
  return {id: crypto.randomUUID(), title: "", situation: "", task: "", action: "", result: "", reflection: "", tags: [], questionIds: questionId ? [questionId] : [], updatedAt: new Date().toISOString()};
}
const fields = [
  {key: "situation", title: "Situation", hint: "Set the scene. What was happening, and why did it matter?"},
  {key: "task", title: "Task", hint: "What were you responsible for? What was the goal?"},
  {key: "action", title: "Action", hint: "What did you personally do? Explain your choices."},
  {key: "result", title: "Result", hint: "What changed? Include evidence or measurements where possible."},
] as const;

function StoryEditor({story, onClose, onSave}: {story: Story; onClose: () => void; onSave: (story: Story) => void}) {
  const [draft, setDraft] = useState(story);
  const [error, setError] = useState("");
  const modal = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    modal.current?.querySelector<HTMLInputElement>("input")?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const elements = modal.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea, select, a[href]");
        if (!elements?.length) return;
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
      }
    };
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handle);
    return () => {document.removeEventListener("keydown", handle); document.body.style.overflow = previousOverflow; before?.focus();};
  }, [onClose]);
  const set = (field: keyof Story, value: unknown) => setDraft(previous => ({...previous, [field]: value}));
  return <div className="modal-overlay"><div ref={modal} className="modal" role="dialog" aria-modal="true" aria-labelledby="story-dialog-title"><div className="modal-header"><div><h2 id="story-dialog-title">{story.title ? "Shape your story" : "A story worth telling"}</h2><p>Build a clear narrative, one STAR step at a time.</p></div><button className="icon-button" aria-label="Close story editor" onClick={onClose}><X size={18}/></button></div><form id="story-form" className="modal-body" onSubmit={event => {event.preventDefault(); const result = storySchema.safeParse({...draft, title: draft.title.trim(), updatedAt: new Date().toISOString()}); if (!result.success) {setError(result.error.issues[0].message); return;} onSave(result.data);}}><div className="form-grid"><div className="field-full"><label htmlFor="story-title">Story title</label><input id="story-title" required maxLength={200} placeholder="A short title you’ll remember" value={draft.title} onChange={e => set("title", e.target.value)}/></div>{fields.map(field => <div key={field.key}><label htmlFor={`story-${field.key}`}>{field.title}</label><textarea id={`story-${field.key}`} maxLength={20000} placeholder={field.hint} value={draft[field.key]} onChange={e => set(field.key, e.target.value)}/></div>)}<div className="field-full"><label htmlFor="story-reflection">Reflection <span className="muted" style={{fontWeight: 400}}>(optional)</span></label><textarea id="story-reflection" maxLength={20000} placeholder="What did you learn? What would you do differently?" value={draft.reflection} onChange={e => set("reflection", e.target.value)} style={{minHeight: 80}}/></div><div className="field-full"><label>Competencies</label><div className="tag-row">{competencies.map(tag => <button type="button" className={`tag-toggle ${draft.tags.includes(tag) ? "active" : ""}`} aria-pressed={draft.tags.includes(tag)} key={tag} onClick={() => set("tags", draft.tags.includes(tag) ? draft.tags.filter(t => t !== tag) : [...draft.tags, tag])}>{tag}</button>)}</div></div><div className="field-full"><label>Connect to questions</label><p className="field-hint">One story can work for several questions. Several stories can answer the same question.</p><div className="linked-questions">{behavioralQuestions.map(question => <label key={question.id}><input type="checkbox" checked={draft.questionIds.includes(question.id)} onChange={() => set("questionIds", draft.questionIds.includes(question.id) ? draft.questionIds.filter(id => id !== question.id) : [...draft.questionIds, question.id])}/><span>{question.question}</span></label>)}</div></div></div>{error && <p className="form-error" role="alert">{error}</p>}</form><div className="modal-footer"><span className="field-hint">You can save an unfinished story.</span><div className="button-row"><button className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" form="story-form">Save story<ArrowRight size={13}/></button></div></div></div></div>;
}

export function BehavioralWorkspace() {
  const {data, mutate, notify} = useWorkspace();
  const [tab, setTab] = useState<"stories" | "questions">("stories");
  const [editing, setEditing] = useState<Story | null>(null);
  const [competency, setCompetency] = useState("");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const stories = data.stories.filter(s => (!competency || s.tags.includes(competency as Competency)) && `${s.title} ${s.situation} ${s.action}`.toLowerCase().includes(search.toLowerCase()));
  const questions = behavioralQuestions.filter(q => (!competency || q.competency === competency) && q.question.toLowerCase().includes(search.toLowerCase()));
  return <>
    <PageHeading eyebrow="YOUR EXPERIENCE, CLEARLY TOLD" title="Find the story behind your skills." description="Turn meaningful moments into answers that show how you think, work, and make an impact." action={<button className="button button-primary" onClick={() => setEditing(blankStory())}><Plus size={15}/>Add a story</button>}/>
    <div className="tabs" role="tablist" aria-label="Behavioral preparation"><button className={`tab ${tab === "stories" ? "active" : ""}`} role="tab" aria-selected={tab === "stories"} onClick={() => {setTab("stories"); setSearch("");}}><BookOpen size={15}/>Your story bank<span>{data.stories.length}</span></button><button className={`tab ${tab === "questions" ? "active" : ""}`} role="tab" aria-selected={tab === "questions"} onClick={() => {setTab("questions"); setSearch("");}}><AudioLines size={15}/>Practice questions<span>20</span></button></div>
    <div className="filters card" style={{borderBottom: "1px solid var(--border)", marginBottom: 22}}><div className="search-input"><Search size={15}/><input aria-label={tab === "stories" ? "Search stories" : "Search behavioral questions"} placeholder={tab === "stories" ? "Search your stories…" : "Search practice questions…"} value={search} onChange={e => setSearch(e.target.value)}/></div><select aria-label="Filter competency" value={competency} onChange={e => setCompetency(e.target.value)}><option value="">All competencies</option>{competencies.map(c => <option key={c}>{c}</option>)}</select></div>
    {tab === "stories" ? stories.length ? <div className="story-grid">{stories.map(story => <article className="card story-card" key={story.id}><div className="story-card-header"><div><h3>{story.title}</h3></div><button className="icon-button" aria-label={`Edit ${story.title}`} onClick={() => setEditing(story)}><Edit3 size={14}/></button></div><p>{story.situation || "Set the scene to start developing this story."}</p><div className="tag-row">{story.tags.map(tag => <Badge key={tag} tone="purple">{tag}</Badge>)}</div><div className="story-card-footer"><div className="star-completion" aria-label={`${fields.filter(f => story[f.key].trim()).length} of 4 STAR sections filled`}>{fields.map(f => <span key={f.key} className={story[f.key].trim() ? "filled" : ""}>{f.title[0]}</span>)}</div><span>{story.questionIds.length} linked · {relativeDate(story.updatedAt)}</span></div><div className="button-row" style={{marginTop: 14, justifyContent: "space-between"}}><Link className="text-link" href={`/interviews?type=behavioral&question=${story.questionIds[0] || "ownership-initiative"}&timed=false`}>Practice aloud<ArrowRight size={12}/></Link>{deleteId === story.id ? <div className="confirmed-delete"><span>Delete?</span><button className="text-link" style={{color: "var(--red)"}} onClick={() => {mutate({kind: "delete-story", id: story.id}); setDeleteId(""); notify("Story deleted");}}>Yes</button><button className="text-link" onClick={() => setDeleteId("")}>Cancel</button></div> : <button className="icon-button" style={{border: 0}} aria-label={`Delete ${story.title}`} onClick={() => setDeleteId(story.id)}><Trash2 size={13}/></button>}</div></article>)}</div> : <div className="card"><EmptyState icon={<BookOpen size={24}/>} title={data.stories.length ? "No matching stories" : "You already have stories worth telling"} description={data.stories.length ? "Try another search or competency." : "A challenging project. A teammate you helped. A mistake you learned from. Start with one moment and build from there."} action={<button className="button button-primary" onClick={() => setEditing(blankStory())}><Plus size={14}/>Write your first story</button>}/></div> : <section className="card">{questions.length ? questions.map(question => {const linked = data.stories.filter(s => s.questionIds.includes(question.id)); return <article className="question-card" key={question.id}><div><Badge tone="purple">{question.competency}</Badge><h3>{question.question}</h3><p>Follow-up: {question.followUp}</p><div className="question-links">{linked.map(story => <button className="question-link" key={story.id} onClick={() => setEditing(story)}><BookOpen size={10} style={{display: "inline", marginRight: 4}}/>{story.title}</button>)}<button className="text-link" style={{fontSize: 10}} onClick={() => setEditing(blankStory(question.id))}><Plus size={11}/>Add a story for this</button></div></div><Link className="button button-secondary button-small" href={`/interviews?type=behavioral&question=${question.id}&timed=false`}><AudioLines size={13}/>Practice</Link></article>;}) : <EmptyState title="No matching questions" description="Try another search or competency."/>}</section>}
    {editing && <StoryEditor key={editing.id} story={editing} onClose={() => setEditing(null)} onSave={story => {mutate({kind: "story", value: story}); setEditing(null); notify("Story saved to your bank");}}/>}
  </>;
}
