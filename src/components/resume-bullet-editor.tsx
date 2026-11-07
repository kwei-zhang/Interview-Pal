"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Bold, Code2, Eye, Italic } from "lucide-react";
import { formatBulletSelection, type BulletFormat } from "@/lib/bullet-formatting";
import { FormattedBullet } from "./formatted-bullet";
import styles from "./resume-bullet-editor.module.css";

const formats = [
  {format: "bold", label: "Bold", shortcut: "Ctrl/⌘ B", icon: Bold},
  {format: "italic", label: "Italic", shortcut: "Ctrl/⌘ I", icon: Italic},
  {format: "code", label: "Inline code", shortcut: "", icon: Code2},
] as const;

export function ResumeBulletEditor({id, number, value, placeholder, onChange, inputRef}: {
  id: string; number: number; value: string; placeholder: string;
  onChange: (value: string) => void;
  inputRef: (element: HTMLTextAreaElement | null) => void;
}) {
  const input = useRef<HTMLTextAreaElement | null>(null);
  const selection = useRef<{start: number; end: number} | null>(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    if (selection.current) {
      input.current?.focus();
      input.current?.setSelectionRange(selection.current.start, selection.current.end);
      selection.current = null;
    }
  }, [value]);

  const format = (style: BulletFormat) => {
    if (!input.current) return;
    const result = formatBulletSelection(value, input.current.selectionStart, input.current.selectionEnd, style);
    if (result.text.length > 4000) {setError("Leave a little room for formatting within the 4,000-character limit."); return;}
    input.current.focus();
    if (result.text !== value) {
      selection.current = result;
      onChange(result.text);
    }
    setError(""); setPreview(true);
  };

  return <div>
    <div className={styles.toolbar} role="group" aria-label={`Formatting for bullet point ${number}`}>
      {formats.map(({format: style, label, shortcut, icon: Icon}) => <button key={style} type="button" aria-label={label} title={shortcut ? `${label} (${shortcut})` : label} onMouseDown={event => event.preventDefault()} onClick={() => format(style)}><Icon size={14}/></button>)}
      <button type="button" className={styles.previewToggle} aria-expanded={preview} aria-controls={`${id}-preview`} onClick={() => setPreview(current => !current)}><Eye size={14}/>Preview</button>
    </div>
    <textarea ref={element => {input.current = element; inputRef(element);}} className={styles.input} id={id} required maxLength={4000} rows={3} placeholder={placeholder} value={value} aria-describedby={error ? `${id}-format-error` : undefined} onChange={event => {setError(""); onChange(event.target.value);}} onKeyDown={event => {
      if (event.nativeEvent.isComposing || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "b" || key === "i") {event.preventDefault(); format(key === "b" ? "bold" : "italic");}
    }}/>
    {error && <p id={`${id}-format-error`} className="form-error" role="alert">{error}</p>}
    <div id={`${id}-preview`} className={styles.preview} hidden={!preview} role="region" aria-label={`Preview of bullet point ${number}`}>
      <span className={styles.previewLabel}>Preview</span>
      {value.trim() ? <FormattedBullet text={value}/> : <p className="field-hint">Your formatted bullet point will appear here.</p>}
    </div>
  </div>;
}
