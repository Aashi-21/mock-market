import {
  EMPTY_PORTFOLIO_START_DATE,
  type Order,
  type SimulationSession,
  type UserAccount,
} from '../types/index.js';
import {
  loadUserAccount as dbLoad,
  saveUserAccount as dbSave,
  createUserAccount as dbCreate,
  listAllAccounts,
  resetUserAccount as dbResetUser,
  resetAllUserAccounts as dbResetAll,
} from '../localDb/userStore.js';
import {
  loadPersistedSession,
  persistSession,
  loadAdminConfig,
} from '../localDb/globalStore.js';
import { createId, roundMoney } from '../utils/helpers.js';

/** Global market session (admin-controlled). */
let globalSession: SimulationSession | null = loadPersistedSession();
const sessionWaiters = new Map<string, Array<(s: SimulationSession) => void>>();

export async function getAccount(userId: string): Promise<UserAccount> {
  const account = dbLoad(userId);
  if (!account) {
    throw Object.assign(new Error('User account not found'), { status: 404 });
  }
  return structuredClone(account);
}

export async function persistAccount(account: UserAccount): Promise<UserAccount> {
  dbSave(account);
  return structuredClone(account);
}

export function createFreshAccount(
  userId: string,
  password: string,
  displayName: string,
): UserAccount {
  return dbCreate(userId, password, displayName);
}

/** @deprecated seed user removed — no-op for compatibility */
export async function ensureSeedUser(): Promise<void> {
  /* local CSV auth; no seed trader */
}

export function getGlobalSession(): SimulationSession | null {
  return globalSession ? structuredClone(globalSession) : null;
}

/** Alias used by older call sites — global sim is not per-user. */
export function getSessionByUser(_userId: string): SimulationSession | null {
  return getGlobalSession();
}

export function getSession(sessionId: string): SimulationSession | null {
  if (!globalSession || globalSession.id !== sessionId) return null;
  return structuredClone(globalSession);
}

export function saveSession(session: SimulationSession): SimulationSession {
  session.updatedAt = new Date().toISOString();
  session.version += 1;
  if (!session.secondsPerMarketMinute) {
    session.secondsPerMarketMinute = loadAdminConfig().secondsPerMarketMinute;
  }
  globalSession = session;
  persistSession(session);
  notifyWaiters(session);
  return structuredClone(session);
}

export function createSession(
  partial: Omit<SimulationSession, 'id' | 'version' | 'updatedAt'>,
): SimulationSession {
  const session: SimulationSession = {
    ...partial,
    id: createId('sim'),
    version: 0,
    updatedAt: new Date().toISOString(),
  };
  return saveSession(session);
}

export function clearGlobalSession(): void {
  if (globalSession) {
    sessionWaiters.delete(globalSession.id);
  }
  globalSession = null;
  persistSession(null);
}

/** @deprecated use clearGlobalSession */
export function clearSession(_userId: string): void {
  clearGlobalSession();
}

export function waitForSessionUpdate(
  sessionId: string,
  sinceVersion: number,
  timeoutMs: number,
): Promise<SimulationSession | null> {
  const current = globalSession;
  if (current && current.id === sessionId && current.version > sinceVersion) {
    return Promise.resolve(structuredClone(current));
  }

  return new Promise((resolve) => {
    const list = sessionWaiters.get(sessionId) ?? [];
    const onUpdate = (s: SimulationSession) => {
      cleanup();
      resolve(structuredClone(s));
    };
    const timer = setTimeout(() => {
      cleanup();
      const latest = globalSession;
      resolve(latest && latest.id === sessionId ? structuredClone(latest) : null);
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      const waiters = sessionWaiters.get(sessionId) ?? [];
      sessionWaiters.set(
        sessionId,
        waiters.filter((w) => w !== onUpdate),
      );
    }

    list.push(onUpdate);
    sessionWaiters.set(sessionId, list);
  });
}

function notifyWaiters(session: SimulationSession): void {
  const waiters = sessionWaiters.get(session.id) ?? [];
  sessionWaiters.set(session.id, []);
  for (const w of waiters) w(session);
}

export function markSnapshot(account: UserAccount, marketDate: string): void {
  const investedMarked = account.holdings.reduce((sum, h) => {
    const last = [...account.ledger].reverse().find((e) => e.symbol === h.symbol);
    const px = last?.price ?? h.averageCost;
    return sum + h.units * px;
  }, 0);

  const snap = {
    date: marketDate,
    cashBalance: roundMoney(account.user.cashBalance),
    investedValue: roundMoney(investedMarked),
    totalValue: roundMoney(account.user.cashBalance + investedMarked),
  };

  const history = [...account.growthHistory];
  const last = history[history.length - 1];
  if (last?.date === marketDate) history[history.length - 1] = snap;
  else history.push(snap);
  account.growthHistory = history;
}

export function upsertOrder(account: UserAccount, order: Order): void {
  const idx = account.orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) account.orders[idx] = order;
  else account.orders.unshift(order);
}

export function getAllAccounts(): UserAccount[] {
  return listAllAccounts();
}

export function resetAccountById(userId: string): UserAccount {
  return dbResetUser(userId);
}

export function resetEveryAccount(): number {
  return dbResetAll();
}

export { EMPTY_PORTFOLIO_START_DATE };
