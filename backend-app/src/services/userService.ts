import {
  getAccount,
  getAllAccounts,
  getGlobalSession,
  persistAccount,
  resetAccountById,
  resetEveryAccount,
} from '../store/memoryStore.js';
import { EMPTY_PORTFOLIO_START_DATE, type UserAccount } from '../types/index.js';
import { roundMoney } from '../utils/helpers.js';
import { listCatalogStocks } from './stockCatalog.js';
import { resolveSimulationStartDate } from './simulationService.js';

export async function getBootstrap(userId: string) {
  const account = await getAccount(userId);
  const session = getGlobalSession();
  const catalog = listCatalogStocks();
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
    stocks: catalog.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      industry: s.industry,
      series: s.series,
      isin: s.isin,
      exchange: s.exchange,
      hasCsv: s.hasCsv,
    })),
    industries: [...new Set(catalog.map((s) => s.industry))].sort(),
    seriesTypes: [...new Set(catalog.map((s) => s.series))].sort(),
  };
}

export async function resetAccount(userId: string): Promise<UserAccount> {
  return resetAccountById(userId);
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

export function adminMonitor() {
  const accounts = getAllAccounts();
  return {
    users: accounts.map((a) => ({
      userId: a.user.id,
      displayName: a.user.displayName,
      cashBalance: a.user.cashBalance,
      holdings: a.holdings,
      pendingOrders: a.orders.filter((o) => o.status === 'PENDING'),
      recentLedger: a.ledger.slice(0, 25),
      latestBuyDate: a.latestBuyDate,
      nextSimulationDate: a.nextSimulationDate,
    })),
    session: getGlobalSession(),
  };
}

export function adminResetAll(): number {
  return resetEveryAccount();
}

export function adminResetUser(userId: string): UserAccount {
  return resetAccountById(userId);
}

export { EMPTY_PORTFOLIO_START_DATE };
