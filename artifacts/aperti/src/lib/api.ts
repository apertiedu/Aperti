export function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("aperti_token");
  return fetch(url, {
    ...options,
    headers: {
      ...(options?.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
