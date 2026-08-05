import {
  createFreshAccount,
  getAccount,
  getSessionByUser,
  persistAccount,
} from '../store/memoryStore.js';
import { resolveSimulationStartDate } from './simulationService.js';
import { EMPTY_PORTFOLIO_START_DATE, type UserAccount } from '../types/index.js';
import { roundMoney } from '../utils/helpers.js';
import { saveUserAccount } from '../stubs/firebaseDb.js';

export async function getBootstrap(userId: string) {
  const account = await getAccount(userId);
  const session = getSessionByUser(userId);
  return {
    user: account.user,
    portfolio: {
      holdings: account.holdings,
      cashBalance: account.user.cashBalance,
      growthHistory: account.growthHistory,
    },
    orders: account.orders,
    ledger: account.ledger,
    latestBuyDate: account.latestBuyDate,
    nextSimulationDate: resolveSimulationStartDate(account),
    session,
  };
}

export async function resetAccount(userId: string): Promise<UserAccount> {
  const fresh = createFreshAccount();
  fresh.user.id = userId;
  // Preserve email/name from existing if present
  try {
    const prev = await getAccount(userId);
    fresh.user.email = prev.user.email;
    fresh.user.displayName = prev.user.displayName;
  } catch {
    /* new */
  }
  fresh.nextSimulationDate = EMPTY_PORTFOLIO_START_DATE;
  await saveUserAccount(fresh);
  return structuredClone(fresh);
}

export async function deposit(userId: string, amount: number): Promise<UserAccount> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('Amount must be a positive number'), { status: 400 });
  }
  if (amount > 10_000_000) {
    throw Object.assign(new Error('Deposit exceeds mock limit'), { status: 400 });
  }
  const account = await getAccount(userId);
  account.user.cashBalance = roundMoney(account.user.cashBalance + amount);
  const today = new Date().toISOString().slice(0, 10);
  account.growthHistory.push({
    date: today,
    cashBalance: account.user.cashBalance,
    investedValue: account.growthHistory.at(-1)?.investedValue ?? 0,
    totalValue: roundMoney(
      account.user.cashBalance + (account.growthHistory.at(-1)?.investedValue ?? 0),
    ),
  });
  return persistAccount(account);
}
