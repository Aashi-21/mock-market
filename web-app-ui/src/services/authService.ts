import type { AuthSession, User } from '../types';
import { apiFetch } from './apiClient';
import { config } from '../config';

const STORAGE_KEY = 'mock-market.auth';
const ADMIN_STORAGE_KEY = 'mock-market.admin';

export function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function getStoredAdmin(): { token: string; username: string } | null {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { token: string; username: string };
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return getStoredSession()?.token ?? null;
}

export function getAdminToken(): string | null {
  return getStoredAdmin()?.token ?? null;
}

export async function login(username: string, password: string): Promise<AuthSession> {
  const data = await apiFetch<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const session: AuthSession = { token: data.token, user: data.user };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function signup(
  username: string,
  password: string,
  displayName?: string,
): Promise<AuthSession> {
  const data = await apiFetch<{ token: string; user: User }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName }),
  });
  const session: AuthSession = { token: data.token, user: data.user };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function logout(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
}

export async function adminLogin(
  username: string,
  password: string,
): Promise<{ token: string; username: string }> {
  const base = config.apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Admin login failed (${res.status})`);
  }
  const data = (await res.json()) as { token: string; username: string };
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(data));
  return data;
}

export async function adminLogout(): Promise<void> {
  localStorage.removeItem(ADMIN_STORAGE_KEY);
}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new Error('Not authenticated as admin');
  const base = config.apiBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { error?: string; message?: string; detail?: string };
      throw new Error(json.error ?? json.message ?? json.detail ?? text);
    } catch (err) {
      if (err instanceof Error && err.message !== text) throw err;
      throw new Error(text || `Admin API error ${res.status}`);
    }
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
