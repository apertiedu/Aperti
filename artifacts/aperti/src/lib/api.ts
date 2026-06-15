export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "ERR_API", status = 0) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "ApiError";
  }
}

const API_BASE = "";
const RETRY_DELAY_MS = 600;
const DEFAULT_TIMEOUT_MS = 20_000;

export function apiFetch(url: string, options?: RequestInit & { timeout?: number }): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(`${API_BASE}${url}`, {
    ...fetchOptions,
    credentials: "include",
    signal: fetchOptions.signal ?? controller.signal,
    headers: {
      ...(fetchOptions.headers as Record<string, string> | undefined),
    },
  }).finally(() => clearTimeout(timer));
}

async function extractErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return res.statusText || `HTTP ${res.status}`;
  try {
    const json = JSON.parse(text);
    if (typeof json?.error === "string") return json.error;
    if (typeof json?.message === "string") return json.message;
    if (json?.error?.message) return json.error.message;
  } catch {
  }
  return text.slice(0, 200);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchJSON<T = any>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(url);
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new ApiError("Request timed out — please try again.", "ERR_TIMEOUT", 408);
    }
    await sleep(RETRY_DELAY_MS);
    try {
      res = await apiFetch(url);
    } catch {
      throw new ApiError("Cannot reach the server — check your connection.", "ERR_NETWORK", 0);
    }
  }
  if (!res.ok && res.status >= 500) {
    await sleep(RETRY_DELAY_MS);
    try {
      res = await apiFetch(url);
    } catch {
      throw new ApiError("Cannot reach the server — check your connection.", "ERR_NETWORK", 0);
    }
  }
  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    const friendlyMsg =
      res.status === 401 ? "Your session has expired — please sign in again." :
      res.status === 403 ? "You don't have permission to do that." :
      res.status === 404 ? msg || "That resource wasn't found." :
      res.status === 429 ? "Too many requests — please slow down." :
      res.status >= 500 ? "A server error occurred — please try again." :
      msg;
    throw new ApiError(friendlyMsg, `ERR_${res.status}`, res.status);
  }
  const data = await res.json();
  if (typeof data === "object" && data !== null && "success" in data && !data.success) {
    throw new ApiError(data.error?.message ?? "Request failed", data.error?.code ?? "ERR_API");
  }
  return ("success" in data && "data" in data ? data.data : data) as T;
}

export async function postJSON<T = any>(url: string, body: unknown, timeout?: number): Promise<T> {
  const res = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeout,
  });
  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    throw new ApiError(msg, `ERR_${res.status}`, res.status);
  }
  return res.json();
}

export async function putJSON<T = any>(url: string, body: unknown, timeout?: number): Promise<T> {
  const res = await apiFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeout,
  });
  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    throw new ApiError(msg, `ERR_${res.status}`, res.status);
  }
  return res.json();
}

export async function patchJSON<T = any>(url: string, body: unknown, timeout?: number): Promise<T> {
  const res = await apiFetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    timeout,
  });
  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    throw new ApiError(msg, `ERR_${res.status}`, res.status);
  }
  return res.json();
}

export async function deleteJSON<T = any>(url: string, timeout?: number): Promise<T> {
  const res = await apiFetch(url, { method: "DELETE", timeout });
  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    throw new ApiError(msg, `ERR_${res.status}`, res.status);
  }
  return res.json();
}
