// Next prefixes Link/router navigation itself. Fetch, browser redirects, and
// public assets need the same build-time prefix explicitly.
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function appPath(path: string, prefix = basePath): string {
  if (!prefix || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)) return path;
  return path === "/" ? prefix : `${prefix}${path}`;
}

export const appFetch: typeof fetch = (input, init) =>
  fetch(typeof input === "string" ? appPath(input) : input, init);
