"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { applyMutation, emptyWorkspace, type WorkspaceData, type WorkspaceMutation, type Attempt, type ProblemProgress } from "@/lib/types";

export const LOCAL_STORAGE_KEY = "interview-pal.workspace.v1";
type SyncState = "loading" | "saved" | "saving" | "error";
interface WorkspaceContextValue {
  data: WorkspaceData; ready: boolean; mode: "demo" | "cloud"; syncState: SyncState; error: string;
  mutate: (mutation: WorkspaceMutation) => void;
  flush: () => Promise<boolean>;
  retry: () => void;
  addAttempt: (attempt: Attempt) => void;
  progressFor: (id: string) => ProblemProgress;
  notify: (message: string) => void;
  notice: string;
}
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
function mutationKey(m: WorkspaceMutation): string {
  if (m.kind === "profile") return "profile";
  if (m.kind === "progress") return `progress:${m.value.problemId}`;
  if (m.kind === "draft") return `draft:${m.value.problemId}:${m.value.language}`;
  if (m.kind === "story") return `story:${m.value.id}`;
  if (m.kind === "session") return `session:${m.value.id}`;
  return `${m.kind === "delete-story" ? "story" : "session"}:${m.id}`;
}
export function WorkspaceProvider({mode, children}: {mode: "demo" | "cloud"; children: React.ReactNode}) {
  const [data, setData] = useState<WorkspaceData>(emptyWorkspace);
  const dataRef = useRef(data);
  const [ready, setReady] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(new Map<string, WorkspaceMutation>());
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const notify = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 5000);
  }, []);
  const persistLocal = useCallback((next: WorkspaceData) => {
    try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next)); setSyncState("saved"); setError(""); }
    catch { setSyncState("error"); setError("Your browser could not save changes. Export your workspace before closing this tab."); }
  }, []);
  const commit = useCallback((next: WorkspaceData) => { dataRef.current = next; setData(next); if (mode === "demo") persistLocal(next); }, [mode, persistLocal]);
  const load = useCallback(async () => {
    setSyncState("loading");
    try {
      let loaded: WorkspaceData;
      if (mode === "demo") {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        loaded = raw ? JSON.parse(raw) : emptyWorkspace();
        if (!loaded.profile || !loaded.progress || !loaded.drafts || !Array.isArray(loaded.stories) || !Array.isArray(loaded.sessions) || !Array.isArray(loaded.attempts)) throw new Error("Your saved local workspace could not be read. Restore a backup or clear this site's storage to start again.");
      } else {
        const response = await fetch("/api/workspace", {cache: "no-store"});
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load your workspace.");
        loaded = body;
      }
      dataRef.current = loaded; setData(loaded); setReady(true); setError(""); setSyncState("saved");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load the workspace."); setSyncState("error"); }
  }, [mode]);
  useEffect(() => { void load(); }, [load]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (mode === "demo") return true;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (inFlight.current) return inFlight.current;
    const work = async () => {
      setSyncState("saving");
      while (pending.current.size) {
        const [key, mutation] = pending.current.entries().next().value!;
        try {
          const response = await fetch("/api/workspace", {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify(mutation)});
          if (!response.ok) { const body = await response.json(); throw new Error(body.error || "Could not save changes."); }
          // A newer edit may have replaced the mutation while this request ran.
          if (pending.current.get(key) === mutation) pending.current.delete(key);
        } catch (e) {
          setSyncState("error"); setError(e instanceof Error ? e.message : "Could not save changes."); return false;
        }
      }
      setSyncState("saved"); setError(""); return true;
    };
    const promise = work(); inFlight.current = promise;
    try { return await promise; } finally { inFlight.current = null; }
  }, [mode]);
  const mutate = useCallback((mutation: WorkspaceMutation) => {
    commit(applyMutation(dataRef.current, mutation));
    if (mode === "cloud") {
      pending.current.set(mutationKey(mutation), mutation);
      setSyncState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { void flush(); }, 450);
    }
  }, [commit, mode, flush]);
  const addAttempt = useCallback((attempt: Attempt) => {
    commit({...dataRef.current, attempts: [attempt, ...dataRef.current.attempts.filter(a => a.id !== attempt.id)].slice(0, 200)});
  }, [commit]);
  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;
    const match = previous.match(/^\/interviews\/([a-f0-9-]+)$/);
    if (match && previous !== pathname) {
      const session = dataRef.current.sessions.find(s => s.id === match[1]);
      if (session?.status === "active") mutate({kind: "session", value: {...session, status: "interrupted", lastActiveAt: new Date().toISOString()}});
    }
  }, [pathname, mutate]);
  useEffect(() => {
    const onPageHide = () => {
      const session = dataRef.current.sessions.find(s => s.status === "active" && pathname === `/interviews/${s.id}`);
      if (session) {
        const value = {...session, status: "interrupted" as const, lastActiveAt: new Date().toISOString()};
        dataRef.current = applyMutation(dataRef.current, {kind: "session", value});
        if (mode === "demo") { try { localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataRef.current)); } catch { /* Existing save error remains visible. */ } }
        else pending.current.set(`session:${session.id}`, {kind: "session", value});
      }
      if (mode === "cloud") {
        // Small independent beacons preserve outstanding changes on tab close.
        for (const mutation of pending.current.values()) navigator.sendBeacon("/api/workspace/beacon", new Blob([JSON.stringify(mutation)], {type: "application/json"}));
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => { if (mode === "cloud" && pending.current.size) { event.preventDefault(); } };
    window.addEventListener("pagehide", onPageHide); window.addEventListener("beforeunload", onBeforeUnload);
    return () => { window.removeEventListener("pagehide", onPageHide); window.removeEventListener("beforeunload", onBeforeUnload); };
  }, [mode, pathname]);
  const progressFor = useCallback((id: string): ProblemProgress => data.progress[id] || {problemId: id, status: "not-started", reviewLater: false, notes: "", updatedAt: new Date().toISOString()}, [data.progress]);
  const retry = useCallback(() => { if (!ready) void load(); else void flush(); }, [ready, load, flush]);
  return <WorkspaceContext.Provider value={{data, ready, mode, syncState, error, mutate, flush, retry, addAttempt, progressFor, notify, notice}}>{children}</WorkspaceContext.Provider>;
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("WorkspaceProvider is required.");
  return context;
}
