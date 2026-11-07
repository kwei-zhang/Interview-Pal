"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Edit3, FileText, Play, Plus, Trash2, X } from "lucide-react";
import type { ResumeBullet } from "@/lib/types";
import { groupResumeProjects, type ResumeProject } from "@/lib/resume-projects";
import { resumeBulletSchema } from "@/lib/validation";
import { useWorkspace } from "./workspace-provider";
import { Badge, EmptyState, PageHeading, relativeDate } from "./ui";
import { ResumeBulletEditor } from "./resume-bullet-editor";
import { FormattedBullet } from "./formatted-bullet";
import styles from "./project-interview-workspace.module.css";

interface ProjectDraft {
  id: string;
  projectId: string;
  name: string;
  originalBulletIds: string[];
  bullets: {id: string; text: string}[];
}
const emptyDraft: ProjectDraft = {id: "", projectId: "", name: "", originalBulletIds: [], bullets: [{id: "new", text: ""}]};

export function ProjectInterviewWorkspace() {
  const {data, mutate, notify} = useWorkspace();
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const textInputs = useRef(new Map<string, HTMLTextAreaElement>());
  const focusBullet = useRef<string | null>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const editing = Boolean(draft.id);
  const projects = groupResumeProjects(data.resumeBullets);

  useEffect(() => {
    if (focusBullet.current) {
      textInputs.current.get(focusBullet.current)?.focus();
      focusBullet.current = null;
    }
  }, [draft.bullets]);

  const reset = () => {setDraft(emptyDraft); setError("");};
  const edit = (project: ResumeProject) => {
    setDraft({id: project.id, projectId: project.bullets[0].projectId || crypto.randomUUID(), name: project.name,
      originalBulletIds: project.bullets.map(bullet => bullet.id), bullets: project.bullets.map(({id, text}) => ({id, text}))});
    setError(""); setDeleting(null);
    projectInput.current?.focus();
  };
  const addBullet = () => {
    const id = crypto.randomUUID();
    focusBullet.current = id;
    setDraft(previous => ({...previous, bullets: [...previous.bullets, {id, text: ""}]}));
    setError("");
  };
  const removeDraftBullet = (id: string) => {
    const index = draft.bullets.findIndex(bullet => bullet.id === id);
    const bullets = draft.bullets.filter(bullet => bullet.id !== id);
    focusBullet.current = bullets[Math.min(index, bullets.length - 1)]?.id || null;
    setDraft(previous => ({...previous, bullets}));
    setError("");
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {setError("Enter a project name."); projectInput.current?.focus(); return;}
    const projectId = draft.projectId || crypto.randomUUID();
    const updatedAt = new Date().toISOString();
    const values: ResumeBullet[] = [];
    for (const [position, bullet] of draft.bullets.entries()) {
      const parsed = resumeBulletSchema.safeParse({id: bullet.id === "new" ? crypto.randomUUID() : bullet.id,
        project: draft.name, projectId, position, text: bullet.text, updatedAt});
      if (!parsed.success) {
        setError(`Bullet point ${position + 1}: ${parsed.error.issues[0].message}`);
        textInputs.current.get(bullet.id)?.focus();
        return;
      }
      values.push(parsed.data);
    }
    // Validate the entire project before changing any saved material.
    for (const value of [...values].reverse()) mutate({kind: "resume-bullet", value});
    for (const id of draft.originalBulletIds) {
      if (!values.some(bullet => bullet.id === id)) mutate({kind: "delete-resume-bullet", id});
    }
    notify(editing ? "Project updated" : "Project added");
    reset();
    projectInput.current?.focus();
  };
  const remove = (project: ResumeProject) => {
    for (const bullet of project.bullets) mutate({kind: "delete-resume-bullet", id: bullet.id});
    if (draft.id === project.id) reset();
    setDeleting(null);
    notify("Project deleted");
    projectInput.current?.focus();
  };

  return <>
    <PageHeading eyebrow="RESUME PREP" title="Project interview" description="Organize your projects and resume bullet points for your next interview."/>
    <div className={styles.layout}>
      <section className={`card ${styles.editor}`} aria-labelledby="resume-editor-title">
        <h2 id="resume-editor-title">{editing ? "Edit project" : "Add a project"}</h2>
        <p className={styles.intro}>Capture what you built, your contribution, and the impact.</p>
        <form onSubmit={save} className={styles.form}>
          <div>
            <label htmlFor="resume-project">Project name</label>
            <input ref={projectInput} id="resume-project" required maxLength={200} placeholder="e.g. Checkout service · Acme" value={draft.name} onChange={event => {setDraft(previous => ({...previous, name: event.target.value})); setError("");}}/>
          </div>
          <fieldset className={styles.bulletFields} aria-describedby={error ? "resume-bullet-hint resume-bullet-error" : "resume-bullet-hint"}>
            <legend>Resume bullet points</legend>
            <p id="resume-bullet-hint" className="field-hint">Add each contribution as a separate point. Select text to format it.</p>
            <div className={styles.draftList}>
              {draft.bullets.map((bullet, index) => <div key={bullet.id} className={styles.draftBullet}>
                <div className={styles.rowHeading}>
                  <label htmlFor={`resume-bullet-${bullet.id}`}>Bullet point {index + 1}</label>
                  {draft.bullets.length > 1 && <button type="button" className="icon-button" aria-label={`Remove bullet point ${index + 1}`} onClick={() => removeDraftBullet(bullet.id)}><X size={14}/></button>}
                </div>
                <ResumeBulletEditor inputRef={element => {if (element) textInputs.current.set(bullet.id, element); else textInputs.current.delete(bullet.id);}} id={`resume-bullet-${bullet.id}`} number={index + 1} placeholder={index === 0 ? "Built a checkout service that reduced payment failures by 30%…" : "Describe another contribution or result…"} value={bullet.text} onChange={text => {setDraft(previous => ({...previous, bullets: previous.bullets.map(row => row.id === bullet.id ? {...row, text} : row)})); setError("");}}/>
              </div>)}
            </div>
            <button type="button" className={`button button-secondary ${styles.addBullet}`} onClick={addBullet}><Plus size={14}/>Add bullet point</button>
          </fieldset>
          {error && <p id="resume-bullet-error" className="form-error" role="alert">{error}</p>}
          <div className="button-row">
            <button type="submit" className="button button-primary"><Check size={15}/>{editing ? "Save changes" : "Save project"}</button>
            {editing && <button type="button" className="button button-secondary" onClick={reset}>Cancel edit</button>}
          </div>
        </form>
      </section>
      <section className={styles.saved} aria-labelledby="resume-projects-title">
        <div className={styles.listHeading}><h2 id="resume-projects-title">Your projects</h2><Badge>{projects.length} {projects.length === 1 ? "project" : "projects"}</Badge></div>
        {projects.length === 0 ? <div className="card"><EmptyState icon={<FileText size={22}/>} title="No projects yet" description="Add a project and its resume bullet points to get started."/></div> :
          <ul className={styles.list}>{projects.map(project => <li key={project.id}>
            <article className={`card ${styles.bullet} ${draft.id === project.id ? styles.editing : ""}`}>
              <h3>{project.name || "Untitled project"}</h3>
              <ul className={styles.projectBullets}>{project.bullets.map(bullet => <li key={bullet.id} className={styles.text}><FormattedBullet text={bullet.text}/></li>)}</ul>
              <div className={styles.footer}>
                <span>{project.bullets.length} {project.bullets.length === 1 ? "bullet point" : "bullet points"} · Updated {relativeDate(project.updatedAt)}</span>
                <div className="button-row">
                  <Link className="button button-primary button-small" href={`/interviews?type=project&project=${encodeURIComponent(project.id)}`}><Play size={13}/>Practice</Link>
                  <button type="button" className="button button-secondary button-small" onClick={() => edit(project)}><Edit3 size={13}/>Edit</button>
                  <button type="button" className="button button-secondary button-small" onClick={() => setDeleting(project.id)}><Trash2 size={13}/>Delete</button>
                </div>
              </div>
              {deleting === project.id && <div className={styles.confirmation}>
                <p>Delete this project and its bullet points?</p>
                <div className="button-row">
                  <button type="button" className={`button button-small ${styles.deleteButton}`} onClick={() => remove(project)}>Confirm delete</button>
                  <button type="button" className="button button-secondary button-small" onClick={() => setDeleting(null)}>Keep it</button>
                </div>
              </div>}
            </article>
          </li>)}</ul>}
      </section>
    </div>
  </>;
}
