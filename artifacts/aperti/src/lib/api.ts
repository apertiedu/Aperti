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

export function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = (() => { try { return localStorage.getItem("aperti_token"); } catch { return null; } })();
  return fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...(options?.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
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

export async function fetchJSON<T = any>(url: string): Promise<T> {
  const res = await apiFetch(url);
  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    throw new ApiError(msg, `ERR_${res.status}`, res.status);
  }
  const data = await res.json();
  if (typeof data === "object" && data !== null && "success" in data && !data.success) {
    throw new ApiError(data.error?.message ?? "Request failed", data.error?.code ?? "ERR_API");
  }
  return ("success" in data && "data" in data ? data.data : data) as T;
}

export async function postJSON<T = any>(url: string, body: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    throw new Error(msg);
  }
  return res.json();
}

export async function putJSON<T = any>(url: string, body: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    throw new Error(msg);
  }
  return res.json();
}

export async function patchJSON<T = any>(url: string, body: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteJSON<T = any>(url: string): Promise<T> {
  const res = await apiFetch(url, { method: "DELETE" });
  if (!res.ok) {
    const msg = await extractErrorMessage(res);
    throw new Error(msg);
  }
  return res.json();
}
