"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, AudioLines, BookOpen, Check, ChevronDown, CircleHelp, Code2, History, LayoutDashboard, Menu, Moon, Settings2, Sparkles, Sun, X, CloudOff, RefreshCw, LockKeyhole } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { LoadingState } from "./ui";
import { codingCollection, problems } from "@/lib/data/catalog";

const navigation = [
  {href: "/", label: "Overview", icon: LayoutDashboard},
  {href: "/coding", label: "Coding practice", icon: Code2},
  {href: "/behavioral", label: "Behavioral prep", icon: BookOpen},
  {href: "/interviews", label: "Mock interviews", icon: AudioLines},
  {href: "/history", label: "Session history", icon: History},
];
export function AppShell({children, email, admin = false}: {children: React.ReactNode; email?: string; admin?: boolean}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const {data, ready, mode, syncState, error, retry, notice} = useWorkspace();
  useEffect(() => {
    const stored = localStorage.getItem("interview-pal.theme");
    const value = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(value); document.documentElement.dataset.theme = value ? "dark" : "light";
  }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  const toggleTheme = () => { const value = !dark; setDark(value); localStorage.setItem("interview-pal.theme", value ? "dark" : "light"); document.documentElement.dataset.theme = value ? "dark" : "light"; };
  const section = navigation.find(n => n.href === "/" ? pathname === "/" : pathname.startsWith(n.href))?.label || (pathname === "/admin" ? "Administration" : "Settings");
  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Skip to content</a>
    {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>}
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <Link className="brand" href="/"><span className="brand-symbol"><AudioLines size={22}/></span><span>interview<span className="brand-light">pal</span><span className="brand-dot">.</span></span></Link>
      <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={20}/></button>
      <div className="workspace-selector"><span className="workspace-avatar">SE</span><div><strong>My workspace</strong><small>Software engineering</small></div><ChevronDown size={14}/></div>
      <div className="nav-label">YOUR PRACTICE SPACE</div>
      <nav aria-label="Main navigation">{navigation.map(({href, label, icon: Icon}) => <Link key={href} href={href} className={`nav-item ${(href === "/" ? pathname === "/" : pathname.startsWith(href)) ? "active" : ""}`}><Icon size={18}/><span>{label}</span>{href === "/coding" && <span className="nav-count">{problems.length}</span>}</Link>)}</nav>
      <div className="sidebar-bottom">
        {admin && <Link href="/admin" className={`nav-item ${pathname === "/admin" ? "active" : ""}`}><LockKeyhole size={18}/>Administration</Link>}
        <div className="sidebar-note"><Sparkles size={18}/><strong>Small steps. Strong answers.</strong><p>A little deliberate practice goes a long way.</p><Link href="/interviews">Start a session<ArrowUpRight size={15}/></Link></div>
        <Link href="/settings" className={`nav-item ${pathname === "/settings" ? "active" : ""}`}><Settings2 size={18}/>Settings</Link>
        <a href={codingCollection.sourceUrl} target="_blank" rel="noreferrer" className="nav-item"><CircleHelp size={18}/>LeetCode study plan<ArrowUpRight size={14}/></a>
        <div className="sidebar-user"><span className="user-avatar">{(data.profile.displayName || email || "You").slice(0, 1).toUpperCase()}</span><div><strong>{data.profile.displayName || "Your workspace"}</strong><small>{mode === "demo" ? "Local demo · this browser" : email || "Private account"}</small></div><span className="online-dot"/></div>
      </div>
    </aside>
    <div className="app-body">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20}/></button><span className="breadcrumb">Workspace<span>/</span><strong>{section}</strong></span></div><div className="topbar-actions"><span className={`save-status ${syncState === "error" ? "save-error" : ""}`}>{syncState === "saved" ? <Check size={13}/> : syncState === "error" ? <CloudOff size={14}/> : <RefreshCw size={12} className={syncState === "saving" ? "spin" : ""}/>}<span>{syncState === "saved" ? mode === "demo" ? "Saved locally" : "All changes saved" : syncState === "saving" ? "Saving…" : syncState === "error" ? "Sync needs attention" : "Loading…"}</span></span><button className="icon-button" aria-label={dark ? "Use light theme" : "Use dark theme"} onClick={toggleTheme}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button></div></header>
      {mode === "demo" && <div className="demo-strip"><span><span className="status-dot"/>Local preview · your work stays in this browser</span><Link href="/settings">Connect your private workspace<ArrowUpRight size={13}/></Link></div>}
      {error && <div className="error-strip" role="alert"><span>{error}</span><button onClick={retry}>Retry</button></div>}
      <main id="main-content" className={`main-content ${pathname.match(/^\/coding\/|^\/interviews\/.+/) ? "main-workspace" : ""}`}>{ready ? children : syncState === "error" ? <div className="empty-state"><h2>Workspace unavailable</h2><p>{error}</p><button className="button button-primary" onClick={retry}>Try again</button></div> : <LoadingState/>}</main>
      <footer className="app-footer"><span>Built for the practice that pays off.</span><span>Interview Pal <span className="footer-dot">•</span> Personal workspace</span></footer>
    </div>
    {notice && <div className="toast" role="status"><Check size={17}/>{notice}</div>}
  </div>;
}
