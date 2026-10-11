"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { loader } from "@monaco-editor/react";
import type { Language } from "@/lib/types";

loader.config({paths: {vs: "/vendor/monaco/vs"}});
const Monaco = dynamic(() => import("@monaco-editor/react").then(module => module.default), {ssr: false});
export function CodeEditor({value, language, onChange}: {value: string; language: Language; onChange: (value: string) => void}) {
  const [plain, setPlain] = useState(false);
  const [theme, setTheme] = useState("vs");
  useEffect(() => {
    setPlain(localStorage.getItem("interview-pal.plain-editor") === "true" || window.innerWidth < 720);
    const update = () => setTheme(document.documentElement.dataset.theme === "dark" ? "vs-dark" : "vs");
    update(); const observer = new MutationObserver(update); observer.observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]}); return () => observer.disconnect();
  }, []);
  return <><div className="editor-toolbar" style={{justifyContent: "flex-end", padding: "5px 12px", borderBottom: 0}}><button className="text-link" style={{fontSize: 9}} onClick={() => {setPlain(!plain); localStorage.setItem("interview-pal.plain-editor", String(!plain));}}>{plain ? "Use Monaco editor" : "Use plain text editor"}</button></div><div className="code-editor">{plain ? <textarea aria-label="Solution code" className="fallback-editor" spellCheck={false} value={value} onChange={e => onChange(e.target.value)}/> : <Monaco key={language} height="360px" language={language} theme={theme} value={value} onChange={value => onChange(value || "")} loading={<div className="loading-state" style={{minHeight: 360}}>Opening editor… <button className="text-link" onClick={() => setPlain(true)}>Use plain text</button></div>} options={{minimap: {enabled: false}, fontSize: 12, lineHeight: 22, padding: {top: 14}, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, wordWrap: "on", lineNumbersMinChars: 3, folding: false, renderLineHighlight: "none", occurrencesHighlight: "off", overviewRulerLanes: 0, scrollbar: {verticalScrollbarSize: 7}, ariaLabel: "Solution code", accessibilitySupport: "on"}}/>}</div></>;
}
