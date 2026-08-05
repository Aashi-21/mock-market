import type { AuthSession } from '../types';
import { apiFetch } from './apiClient';

const SESSION_KEY = 'mock-market.auth';

export async function login(email: string, password: string): Promise<AuthSession> {
  const result = await apiFetch<{ token: string; user: AuthSession['user'] }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const session: AuthSession = { token: result.token, user: result.user };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function logout(): Promise<void> {
  localStorage.removeItem(SESSION_KEY);
}

export function getStoredSession(): AuthSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function getToken(): string | null {
  return getStoredSession()?.token ?? null;
}
