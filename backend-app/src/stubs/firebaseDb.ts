/**
 * Stub: Firebase Realtime Database.
 * In-memory map today; swap for firebase-admin database().ref(...) later.
 */

import type { UserAccount } from '../types/index.js';

const db = new Map<string, unknown>();

function pathKey(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

export async function rtdbGet<T>(path: string): Promise<T | null> {
  // TODO(firebase-rtdb): const snap = await admin.database().ref(path).get(); return snap.val();
  const value = db.get(pathKey(path));
  return (value as T | undefined) ?? null;
}

export async function rtdbSet<T>(path: string, value: T): Promise<void> {
  // TODO(firebase-rtdb): await admin.database().ref(path).set(value);
  db.set(pathKey(path), structuredClone(value));
}

export async function rtdbUpdate(path: string, patch: Record<string, unknown>): Promise<void> {
  // TODO(firebase-rtdb): await admin.database().ref(path).update(patch);
  const key = pathKey(path);
  const current = (db.get(key) as Record<string, unknown> | undefined) ?? {};
  db.set(key, { ...current, ...structuredClone(patch) });
}

export async function saveUserAccount(account: UserAccount): Promise<void> {
  await rtdbSet(`users/${account.user.id}`, account);
}

export async function loadUserAccount(userId: string): Promise<UserAccount | null> {
  return rtdbGet<UserAccount>(`users/${userId}`);
}

export function __resetRtdbForTests(): void {
  db.clear();
}
