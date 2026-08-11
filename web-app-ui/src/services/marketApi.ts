import type {
  CatalogStock,
  LedgerEntry,
  Order,
  OrderKind,
  OrderSide,
  Portfolio,
  SimulationSession,
  User,
} from '../types';
import { apiFetch } from './apiClient';
import { getToken } from './authService';

export interface BootstrapResponse {
  user: User;
  portfolio: Portfolio;
  orders: Order[];
  ledger: LedgerEntry[];
  latestBuyDate: string | null;
  nextSimulationDate: string;
  session: SimulationSession | null;
  stocks?: CatalogStock[];
  industries?: string[];
  seriesTypes?: string[];
}

export interface CandleBar {
  minute_index: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandlesResponse {
  symbol: string;
  date: string;
  candles: CandleBar[];
  sessionId: string | null;
}

function auth() {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');
  return token;
}

function normalizeOrders(orders: Order[]): Order[] {
  return orders.map((o) => ({
    ...o,
    isPreSimulation: o.kind === 'PRE_SIMULATION',
    limitPrice: o.fillPrice ?? undefined,
  }));
}

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  const data = await apiFetch<BootstrapResponse>('/user/bootstrap', { token: auth() });
  return { ...data, orders: normalizeOrders(data.orders) };
}

export async function fetchStockCatalog(params?: {
  series?: string;
  industry?: string;
}): Promise<{ stocks: CatalogStock[]; industries: string[]; seriesTypes: string[] }> {
  const q = new URLSearchParams();
  if (params?.series) q.set('series', params.series);
  if (params?.industry) q.set('industry', params.industry);
  const suffix = q.toString() ? `?${q}` : '';
  return apiFetch(`/stocks${suffix}`, { token: auth() });
}

export async function fetchCandles(
  symbol: string,
  date: string,
  opts?: { upToMinute?: number; seed?: number },
): Promise<CandlesResponse> {
  const q = new URLSearchParams({ date });
  if (opts?.upToMinute != null) q.set('upToMinute', String(opts.upToMinute));
  if (opts?.seed != null) q.set('seed', String(opts.seed));
  return apiFetch(`/market/candles/${encodeURIComponent(symbol)}?${q}`, { token: auth() });
}

export async function placeOrder(input: {
  symbol: string;
  side: OrderSide;
  units: number;
  kind: OrderKind;
  simulationCycle?: number | null;
}): Promise<{ order: Order; portfolio: Portfolio; session: SimulationSession | null }> {
  return apiFetch('/orders', {
    method: 'POST',
    token: auth(),
    body: JSON.stringify(input),
  });
}

export async function cancelOrder(orderId: string): Promise<void> {
  await apiFetch(`/orders/${orderId}`, {
    method: 'DELETE',
    token: auth(),
  });
}

export async function startSimulation(): Promise<BootstrapResponse> {
  const data = await apiFetch<BootstrapResponse>('/simulation/start', {
    method: 'POST',
    token: auth(),
  });
  return { ...data, orders: normalizeOrders(data.orders) };
}

export async function continueSimulation(): Promise<BootstrapResponse> {
  const data = await apiFetch<BootstrapResponse>('/simulation/continue', {
    method: 'POST',
    token: auth(),
  });
  return { ...data, orders: normalizeOrders(data.orders) };
}

export async function stopSimulation(): Promise<{
  session: SimulationSession;
  portfolio: Portfolio;
  orders: Order[];
  ledger: LedgerEntry[];
  user: User;
}> {
  const data = await apiFetch<{
    session: SimulationSession;
    portfolio: Portfolio;
    orders: Order[];
    ledger: LedgerEntry[];
    user: User;
  }>('/simulation/stop', {
    method: 'POST',
    token: auth(),
  });
  return { ...data, orders: normalizeOrders(data.orders) };
}

export async function pollSession(sinceVersion: number, waitMs: number): Promise<{
  session: SimulationSession;
  portfolio: Portfolio;
  orders: Order[];
  ledger: LedgerEntry[];
} | null> {
  const data = await apiFetch<{
    session: SimulationSession;
    portfolio: Portfolio;
    orders: Order[];
    ledger: LedgerEntry[];
  } | null>(`/simulation/session?sinceVersion=${sinceVersion}&waitMs=${waitMs}`, {
    token: auth(),
  });
  if (!data) return null;
  return { ...data, orders: normalizeOrders(data.orders) };
}

export async function resetAccount(): Promise<BootstrapResponse> {
  const data = await apiFetch<BootstrapResponse>('/user/reset', {
    method: 'POST',
    token: auth(),
  });
  return {
    ...data,
    orders: normalizeOrders(data.orders ?? []),
    ledger: data.ledger ?? [],
    latestBuyDate: null,
    nextSimulationDate: data.nextSimulationDate,
    session: null,
  };
}

export async function deposit(amount: number): Promise<{ cashBalance: number; portfolio: Portfolio }> {
  return apiFetch('/wallet/deposit', {
    method: 'POST',
    token: auth(),
    body: JSON.stringify({ amount }),
  });
}
