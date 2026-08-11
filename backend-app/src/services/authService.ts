import { config } from '../config.js';
import {
  authenticateUser,
  createUserAccount,
  loadUserAccount,
} from '../localDb/userStore.js';
import { getAccount, persistAccount } from '../store/memoryStore.js';
import type { UserAccount, UserProfile } from '../types/index.js';

function userToken(userId: string): string {
  return `user-token.${userId}.${Date.now()}`;
}

function adminToken(): string {
  return `admin-token.${config.adminUsername}.${Date.now()}`;
}

export async function signup(
  username: string,
  password: string,
  displayName?: string,
): Promise<{ token: string; user: UserProfile }> {
  const account = createUserAccount(username, password, displayName ?? username);
  return { token: userToken(account.user.id), user: account.user };
}

export async function login(
  username: string,
  password: string,
): Promise<{ token: string; user: UserProfile }> {
  const account = authenticateUser(username, password);
  return { token: userToken(account.user.id), user: account.user };
}

export async function adminLogin(
  username: string,
  password: string,
): Promise<{ token: string; username: string; role: 'admin' }> {
  if (
    username.trim() !== config.adminUsername ||
    password !== config.adminPassword
  ) {
    throw Object.assign(new Error('Invalid admin credentials'), { status: 401 });
  }
  return {
    token: adminToken(),
    username: config.adminUsername,
    role: 'admin',
  };
}

export async function requireUser(authHeader: string | undefined): Promise<UserAccount> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Missing Bearer token'), { status: 401 });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (token.startsWith('admin-token.')) {
    throw Object.assign(new Error('Admin token cannot access trader routes'), { status: 403 });
  }
  if (!token.startsWith('user-token.')) {
    throw Object.assign(new Error('Invalid auth token'), { status: 401 });
  }
  const userId = token.split('.')[1];
  if (!userId) throw Object.assign(new Error('Invalid auth token'), { status: 401 });
  const account = loadUserAccount(userId);
  if (!account) throw Object.assign(new Error('User account not found'), { status: 404 });
  return structuredClone(account);
}

export async function requireAdmin(authHeader: string | undefined): Promise<{ username: string }> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Missing Bearer token'), { status: 401 });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token.startsWith('admin-token.')) {
    throw Object.assign(new Error('Admin authentication required'), { status: 403 });
  }
  const username = token.split('.')[1];
  if (username !== config.adminUsername) {
    throw Object.assign(new Error('Invalid admin token'), { status: 401 });
  }
  return { username };
}

/** Re-export for callers that still import getAccount via auth */
export { getAccount, persistAccount };
