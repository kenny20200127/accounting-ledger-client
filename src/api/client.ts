import { API_PREFIX } from '../api-url';

export async function api<T>(
  path: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_PREFIX}/${path.replace(/^\//, '')}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return body as T;
}
