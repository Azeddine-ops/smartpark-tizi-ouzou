/** Utilitaires côté client (SWR). */
export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error ?? `Erreur ${res.status}`) as Error & {
      status?: number;
      payload?: unknown;
    };
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data as T;
}

export async function postJSON<T = unknown>(
  url: string,
  body: unknown,
  method = "POST",
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error ?? `Erreur ${res.status}`) as Error & {
      status?: number;
      payload?: unknown;
    };
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data as T;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
