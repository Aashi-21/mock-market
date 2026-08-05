import { config } from '../config';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${config.apiBaseUrl}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(config.backendApiKey ? { 'X-Api-Key': config.backendApiKey } : {}),
      ...headers,
    },
  });

  if (res.status === 204) {
    return null as T;
  }

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    throw new ApiError(res.status, payload.error ?? payload.message ?? res.statusText);
  }

  return payload as T;
}
