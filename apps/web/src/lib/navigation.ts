/** A detail page can return to its originating list, including the list query. */
export function backDestination(state: unknown, fallback: string, allowedPath: RegExp): string {
  if (!state || typeof state !== "object" || !("from" in state)) return fallback;
  const from = state.from;
  if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//")) return fallback;
  try {
    const url = new URL(from, "https://ipo-mania.local");
    if (url.origin !== "https://ipo-mania.local" || !allowedPath.test(url.pathname))
      return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
