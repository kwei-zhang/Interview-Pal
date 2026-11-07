export type BulletFormat = "bold" | "italic" | "code";

export function formatBulletSelection(text: string, start: number, end: number, format: BulletFormat) {
  const raw = text.slice(start, end);
  if (raw && !raw.trim()) return {text, start, end};
  if (raw) {
    start += raw.length - raw.trimStart().length;
    end -= raw.length - raw.trimEnd().length;
  }
  const selected = text.slice(start, end);
  const content = selected || {bold: "bold text", italic: "italic text", code: "code"}[format];
  const marker = format === "bold" ? "**" : format === "italic" ? "_" : "`".repeat(Math.max(0, ...(content.match(/`+/g) || []).map(run => run.length)) + 1);
  const padding = format === "code" && (content.startsWith("`") || content.endsWith("`")) ? " " : "";
  const before = marker + padding, after = padding + marker;
  if (selected && text.slice(start - before.length, start) === before && text.slice(end, end + after.length) === after) {
    return {text: text.slice(0, start - before.length) + selected + text.slice(end + after.length), start: start - before.length, end: end - before.length};
  }
  const selectedMarker = format === "bold" ? "**" : format === "italic" ? "_" : selected.match(/^`+/)?.[0];
  if (selectedMarker && selected.length > selectedMarker.length * 2 && selected.startsWith(selectedMarker) && selected.endsWith(selectedMarker)) {
    const unwrapped = selected.slice(selectedMarker.length, -selectedMarker.length);
    return {text: text.slice(0, start) + unwrapped + text.slice(end), start, end: start + unwrapped.length};
  }
  return {text: text.slice(0, start) + before + content + after + text.slice(end), start: start + before.length, end: start + before.length + content.length};
}
