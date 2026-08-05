import {
  EMPTY_PORTFOLIO_START_DATE,
  type Order,
  type SimulationSession,
  type UserAccount,
} from '../types/index.js';
import { loadUserAccount, saveUserAccount } from '../stubs/firebaseDb.js';
import { createId, roundMoney } from '../utils/helpers.js';

const sessions = new Map<string, SimulationSession>();
/** userId → sessionId */
const userSessions = new Map<string, string>();
/** Waiters for long-poll: sessionId → resolve callbacks */
const sessionWaiters = new Map<string, Array<(s: SimulationSession) => void>>();

export async function ensureSeedUser(): Promise<UserAccount> {
  const existing = await loadUserAccount('usr_mock_001');
  if (existing) return existing;

  const account = createFreshAccount();
  await saveUserAccount(account);
  return account;
}

export function createFreshAccount(): UserAccount {
  const now = new Date().toISOString();
  return {
    user: {
      id: 'usr_mock_001',
      email: 'trader@mockmarket.in',
      displayName: 'Aarav Mehta',
      cashBalance: 250_000,
      createdAt: now,
    },
    holdings: [],
    orders: [],
    ledger: [],
    growthHistory: [
      {
        date: EMPTY_PORTFOLIO_START_DATE,
        totalValue: 250_000,
        cashBalance: 250_000,
        investedValue: 0,
      },
    ],
    latestBuyDate: null,
    nextSimulationDate: EMPTY_PORTFOLIO_START_DATE,
    passwordHash: 'demo1234', // stub only
  };
}

export async function getAccount(userId: string): Promise<UserAccount> {
  const account = await loadUserAccount(userId);
  if (!account) {
    throw Object.assign(new Error('User account not found'), { status: 404 });
  }
  return structuredClone(account);
}

export async function persistAccount(account: UserAccount): Promise<UserAccount> {
  await saveUserAccount(account);
  return structuredClone(account);
}

export function getSessionByUser(userId: string): SimulationSession | null {
  const id = userSessions.get(userId);
  if (!id) return null;
  const session = sessions.get(id);
  return session ? structuredClone(session) : null;
}

export function getSession(sessionId: string): SimulationSession | null {
  const session = sessions.get(sessionId);
  return session ? structuredClone(session) : null;
}

export function saveSession(session: SimulationSession): SimulationSession {
  session.updatedAt = new Date().toISOString();
  session.version += 1;
  sessions.set(session.id, session);
  userSessions.set(session.userId, session.id);
  notifyWaiters(session);
  return structuredClone(session);
}

export function createSession(partial: Omit<SimulationSession, 'id' | 'version' | 'updatedAt'>): SimulationSession {
  const session: SimulationSession = {
    ...partial,
    id: createId('sim'),
    version: 0,
    updatedAt: new Date().toISOString(),
  };
  return saveSession(session);
}

export function clearSession(userId: string): void {
  const id = userSessions.get(userId);
  if (!id) return;
  sessions.delete(id);
  userSessions.delete(userId);
  sessionWaiters.delete(id);
}

export function waitForSessionUpdate(
  sessionId: string,
  sinceVersion: number,
  timeoutMs: number,
): Promise<SimulationSession | null> {
  const current = sessions.get(sessionId);
  if (current && current.version > sinceVersion) {
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
      const latest = sessions.get(sessionId);
      resolve(latest ? structuredClone(latest) : null);
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
  const invested = account.holdings.reduce(
    (sum, h) => sum + h.units * h.averageCost,
    0,
  );
  // Prefer live marks when available via last ledger/order prices later; use avg as fallback
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
  void invested;
}

export function upsertOrder(account: UserAccount, order: Order): void {
  const idx = account.orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) account.orders[idx] = order;
  else account.orders.unshift(order);
}
