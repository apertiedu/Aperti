const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export function isOffline() { return !navigator.onLine; }

export async function authFetch(
  url: string,
  opts: RequestInit = {},
  retries = MAX_RETRIES
): Promise<Response> {
  const token = localStorage.getItem("aperti_token") || "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers as Record<string, string> || {}),
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...opts, headers });
      if (res.status < 500 || attempt === retries) return res;
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    } catch (err) {
      if (attempt === retries) {
        if (!navigator.onLine) throw new OfflineError();
        throw err;
      }
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw new Error("Request failed after retries");
}

export class OfflineError extends Error {
  constructor() { super("You appear to be offline — please check your connection."); this.name = "OfflineError"; }
}

export function handleApiError(status: number, fallback?: string): string {
  if (status === 401) return "Your session has expired — please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "This resource could not be found.";
  if (status === 409) return "This item already exists.";
  if (status === 422) return "The information provided is invalid.";
  if (status === 429) return "Too many requests — please slow down.";
  if (status >= 500) return "Something went wrong on our end — please try again.";
  return fallback || "An unexpected error occurred.";
}

export async function safeJson<T = unknown>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    let msg = handleApiError(res.status);
    try { const d = JSON.parse(text); msg = d.error || d.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}
