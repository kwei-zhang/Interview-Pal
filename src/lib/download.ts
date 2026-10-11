export function downloadText(filename: string, content: string, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], {type: mime}));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
