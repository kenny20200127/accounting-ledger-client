export async function read<T>(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      Array.isArray(body.message)
        ? body.message.join(', ')
        : body.message || 'Request failed.',
    );
  }
  return body as T;
}
