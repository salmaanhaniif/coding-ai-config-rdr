export async function api<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch('/api' + url, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const e = data.error;
    const details = Array.isArray(e?.details)
      ? e.details
          .map(
            (d: { message?: string; path?: string[] }) =>
              (d.path?.join('.') ?? '') + ': ' + d.message,
          )
          .join('; ')
      : e?.details
        ? JSON.stringify(e.details)
        : '';
    throw new Error((e?.message ?? 'Permintaan gagal.') + (details ? ' ' + details : ''));
  }
  return data as T;
}
