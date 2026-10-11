"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Code2, ExternalLink, Search, Star } from "lucide-react";
import { problems, topics } from "@/lib/data/catalog";
import type { ProgressStatus } from "@/lib/types";
import { useWorkspace } from "./workspace-provider";
import { Badge, DifficultyBadge, EmptyState, PageHeading } from "./ui";

const PAGE_SIZE = 25;
export function CodingLibrary() {
  const {progressFor, mutate, notify} = useWorkspace();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [status, setStatus] = useState("");
  const [onlyRunnable, setOnlyRunnable] = useState(false);
  const [onlyReview, setOnlyReview] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => { setOnlyReview(new URLSearchParams(window.location.search).get("review") === "true"); }, []);
  const filtered = useMemo(() => problems.filter(p => {
    const progress = progressFor(p.id);
    return (!query || `${p.title} ${p.topic}`.toLowerCase().includes(query.toLowerCase())) && (!topic || p.topic === topic) && (!difficulty || p.difficulty === difficulty) && (!status || progress.status === status) && (!onlyRunnable || p.runnable) && (!onlyReview || progress.reviewLater);
  }), [query, topic, difficulty, status, onlyRunnable, onlyReview, progressFor]);
  useEffect(() => { setPage(0); }, [query, topic, difficulty, status, onlyRunnable, onlyReview]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const solved = problems.filter(p => progressFor(p.id).status === "solved").length;
  const updateStatus = (id: string, value: ProgressStatus) => { mutate({kind: "progress", value: {...progressFor(id), status: value, updatedAt: new Date().toISOString()}}); };
  const toggleReview = (id: string) => {const progress = progressFor(id); mutate({kind: "progress", value: {...progress, reviewLater: !progress.reviewLater, updatedAt: new Date().toISOString()}}); notify(progress.reviewLater ? "Removed from your review list" : "Added to your review list");};
  return <>
    <PageHeading eyebrow="THINK · BUILD · EXPLAIN" title="Your coding practice." description="Work through NeetCode 150 at your own pace. Keep your thinking and your progress in one place." action={<Link href="/interviews?type=coding" className="button button-primary"><Code2 size={15}/>Mock coding interview<ArrowRight size={14}/></Link>}/>
    <div className="catalog-summary"><span><strong>{solved} / 150</strong> solved</span><span className="dot-separator">|</span><span><strong>15</strong> available for interviews</span><span className="dot-separator">|</span><a className="text-link" href="https://neetcode.io/practice/practice/neetcode150" target="_blank" rel="noreferrer">NeetCode curriculum<ExternalLink size={12}/></a></div>
    <section className="card"><div className="filters"><div className="search-input"><Search size={15}/><input aria-label="Search coding problems" placeholder="Search problems or topics…" value={query} onChange={e => setQuery(e.target.value)}/></div><select aria-label="Filter topic" value={topic} onChange={e => setTopic(e.target.value)}><option value="">All topics</option>{topics.map(t => <option key={t}>{t}</option>)}</select><select aria-label="Filter difficulty" value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="">All difficulties</option>{["Easy", "Medium", "Hard"].map(d => <option key={d}>{d}</option>)}</select><select aria-label="Filter progress" value={status} onChange={e => setStatus(e.target.value)}><option value="">All progress</option><option value="not-started">Not started</option><option value="practicing">Practicing</option><option value="solved">Solved</option></select><label className="filter-check"><input type="checkbox" checked={onlyRunnable} onChange={e => setOnlyRunnable(e.target.checked)}/>Interview available</label><label className="filter-check"><input type="checkbox" checked={onlyReview} onChange={e => setOnlyReview(e.target.checked)}/>Review later</label></div>
    {visible.length ? <div className="table-wrap"><table><thead><tr><th>Problem</th><th>Topic</th><th>Difficulty</th><th>Workspace</th><th>Progress</th><th><span className="sr-only">Review later</span></th></tr></thead><tbody>{visible.map(problem => <tr key={problem.id}><td><Link href={`/coding/${problem.id}`} className="problem-link"><span className="problem-number">{String(problems.indexOf(problem) + 1).padStart(2, "0")}</span>{problem.title}</Link></td><td className="muted">{problem.topic}</td><td><DifficultyBadge difficulty={problem.difficulty}/></td><td><Badge tone={problem.runnable ? "purple" : "neutral"}>{problem.runnable ? <><Code2 size={10}/>Interview</> : <><ExternalLink size={10}/>External</>}</Badge></td><td><select className="status-select" aria-label={`Progress for ${problem.title}`} value={progressFor(problem.id).status} onChange={e => updateStatus(problem.id, e.target.value as ProgressStatus)}><option value="not-started">Not started</option><option value="practicing">Practicing</option><option value="solved">Solved</option></select></td><td><button className={`review-button ${progressFor(problem.id).reviewLater ? "selected" : ""}`} aria-label={`Review later: ${problem.title}`} aria-pressed={progressFor(problem.id).reviewLater} onClick={() => toggleReview(problem.id)}><Star size={16} fill={progressFor(problem.id).reviewLater ? "currentColor" : "none"}/></button></td></tr>)}</tbody></table></div> : <EmptyState icon={<Search size={23}/>} title="No problems match yet" description="Try a different search or adjust your filters." action={<button className="button button-secondary" onClick={() => {setQuery(""); setTopic(""); setDifficulty(""); setStatus(""); setOnlyRunnable(false); setOnlyReview(false);}}>Clear filters</button>}/>}
    <div className="results-footer"><span>{filtered.length ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length} problems` : "0 matching problems"}</span><span>Practice on LeetCode. Track all 150 here.</span><div className="button-row"><button className="icon-button" disabled={currentPage === 0} onClick={() => setPage(p => p - 1)} aria-label="Previous page"><ArrowLeft size={13}/></button><span>{currentPage + 1} / {pages}</span><button className="icon-button" disabled={currentPage >= pages - 1} onClick={() => setPage(p => p + 1)} aria-label="Next page"><ArrowRight size={13}/></button></div></div></section>
  </>;
}
