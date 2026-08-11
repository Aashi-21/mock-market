import {
  EMPTY_PORTFOLIO_START_DATE,
  MAX_SIMULATION_DAYS,
  NSE_MINUTES_PER_DAY,
  type LiveQuote,
  type Order,
  type SimulationSession,
  type UserAccount,
} from '../types/index.js';
import { fetchDayBars, getStockMeta, getNiftyPool } from '../stubs/stockPriceApi.js';
import {
  clearGlobalSession,
  createSession,
  getAccount,
  getAllAccounts,
  getGlobalSession,
  getSession,
  persistAccount,
  saveSession,
} from '../store/memoryStore.js';
import { applyFill, nonZeroHoldings } from './portfolioMath.js';
import { fetchIntradayPath, resampleCloses } from './simulationAgentClient.js';
import { nextTradingDay, roundPrice } from '../utils/helpers.js';
import { loadAdminConfig, saveAdminConfig } from '../localDb/globalStore.js';

interface DayRuntime {
  sessionId: string;
  paths: Map<string, number[]>;
  tickTimer: NodeJS.Timeout | null;
  dayTimer: NodeJS.Timeout | null;
  analysisTimer: NodeJS.Timeout | null;
}

let runtime: DayRuntime | null = null;

function timingMs(secondsPerMarketMinute: number): { tickMs: number; dayMs: number; tickCount: number } {
  const tickMs = Math.max(100, Math.round(secondsPerMarketMinute * 1000));
  const tickCount = NSE_MINUTES_PER_DAY;
  const dayMs = tickMs * tickCount;
  return { tickMs, dayMs, tickCount };
}

export function resolveSimulationStartDate(account: UserAccount): string {
  if (nonZeroHoldings(account.holdings).length === 0 && !account.latestBuyDate) {
    return EMPTY_PORTFOLIO_START_DATE;
  }
  const anchor = account.latestBuyDate ?? account.nextSimulationDate ?? EMPTY_PORTFOLIO_START_DATE;
  return nextTradingDay(anchor);
}

/** Full catalog — prefer names that have OHLC CSVs. */
export function buildUniverse(): string[] {
  const withCsv = getNiftyPool().filter((m) => m.hasCsv).map((m) => m.symbol);
  if (withCsv.length > 0) return withCsv;
  return getNiftyPool().map((m) => m.symbol);
}

function hashSeed(symbol: string, date: string, cycle: number): number {
  let h = 2166136261;
  const text = `${symbol}|${date}|${cycle}`;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

async function fillPreOrdersForAllUsers(marketDate: string, cycle: number): Promise<void> {
  const accounts = getAllAccounts();
  for (const account of accounts) {
    const pending = account.orders.filter(
      (o) => o.kind === 'PRE_SIMULATION' && o.status === 'PENDING',
    );
    if (pending.length === 0) continue;
    const symbols = [...new Set(pending.map((o) => o.symbol))];
    const bars = await fetchDayBars(symbols, marketDate);
    const openBySymbol = new Map(bars.map((b) => [b.symbol, b.open]));
    for (const order of pending) {
      const open = openBySymbol.get(order.symbol);
      if (open == null) {
        order.status = 'REJECTED';
        continue;
      }
      try {
        applyFill(account, order, open, marketDate, 'Pre-simulation fill at open');
        order.simulationCycle = cycle;
      } catch {
        order.status = 'REJECTED';
      }
    }
    await persistAccount(account);
  }
}

export async function adminStartSimulation(opts?: {
  marketDate?: string;
  secondsPerMarketMinute?: number;
}): Promise<SimulationSession> {
  const existing = getGlobalSession();
  if (existing && (existing.status === 'TRADING' || existing.status === 'ANALYSIS')) {
    throw Object.assign(new Error('Simulation already active'), { status: 409 });
  }

  const cfg = loadAdminConfig();
  if (opts?.secondsPerMarketMinute != null) {
    saveAdminConfig({ secondsPerMarketMinute: opts.secondsPerMarketMinute });
  }
  const secondsPerMarketMinute =
    opts?.secondsPerMarketMinute ?? loadAdminConfig().secondsPerMarketMinute ?? cfg.secondsPerMarketMinute;

  const startDate = opts?.marketDate || EMPTY_PORTFOLIO_START_DATE;
  await fillPreOrdersForAllUsers(startDate, 1);

  const session = createSession({
    userId: 'global',
    status: 'TRADING',
    startMarketDate: startDate,
    currentMarketDate: startDate,
    cycle: 1,
    maxCycles: MAX_SIMULATION_DAYS,
    dayStartedAt: null,
    dayEndsAt: null,
    analysisEndsAt: null,
    tickIndex: 0,
    tickCount: 0,
    quotes: [],
    secondsPerMarketMinute,
  });

  await beginTradingDay(session.id);
  return getSession(session.id)!;
}

export async function adminContinueSimulation(): Promise<SimulationSession> {
  const session = getGlobalSession();
  if (!session || session.status !== 'ANALYSIS') {
    throw Object.assign(new Error('No analysis window active to continue'), { status: 400 });
  }
  if (session.cycle >= session.maxCycles) {
    throw Object.assign(new Error('Maximum simulation days reached'), { status: 400 });
  }

  session.cycle += 1;
  session.currentMarketDate = nextTradingDay(session.currentMarketDate);
  saveSession(session);
  await fillPreOrdersForAllUsers(session.currentMarketDate, session.cycle);
  await beginTradingDay(session.id);
  return getSession(session.id)!;
}

export async function adminStopSimulation(): Promise<SimulationSession | null> {
  const session = getGlobalSession();
  if (!session) {
    throw Object.assign(new Error('No active simulation'), { status: 404 });
  }
  stopRuntimeTimers();
  session.status = 'ENDED';
  session.dayEndsAt = session.dayEndsAt ?? new Date().toISOString();
  session.analysisEndsAt = null;
  saveSession(session);

  for (const account of getAllAccounts()) {
    account.nextSimulationDate = nextTradingDay(session.currentMarketDate);
    await persistAccount(account);
  }

  const ended = getSession(session.id);
  clearGlobalSession();
  return ended;
}

export function adminUpdateTiming(secondsPerMarketMinute: number): {
  secondsPerMarketMinute: number;
} {
  return saveAdminConfig({ secondsPerMarketMinute });
}

export function adminGetConfig(): { secondsPerMarketMinute: number; session: SimulationSession | null } {
  return {
    secondsPerMarketMinute: loadAdminConfig().secondsPerMarketMinute,
    session: getGlobalSession(),
  };
}

async function beginTradingDay(sessionId: string): Promise<void> {
  stopRuntimeTimers();

  const session = getSession(sessionId);
  if (!session) return;

  const symbols = buildUniverse();
  const bars = await fetchDayBars(symbols, session.currentMarketDate);
  const { tickMs, dayMs, tickCount } = timingMs(session.secondsPerMarketMinute);

  const paths = new Map<string, number[]>();
  const quotes: LiveQuote[] = [];

  // Sequential to avoid hammering simulation-agent; acceptable for local use
  for (const bar of bars) {
    const meta = getStockMeta(bar.symbol);
    if (!meta) continue;
    try {
      const sim = await fetchIntradayPath({
        stockId: bar.symbol,
        date: session.currentMarketDate,
        dayBar: {
          previous_close: bar.previousClose,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          last: bar.last ?? bar.close,
          close: bar.close,
          vwap: bar.vwap,
          volume: bar.volume,
          turnover: bar.turnover,
          trades: bar.trades,
          deliverable_volume: bar.deliverableVolume,
          deliverable_pct: bar.deliverablePct,
        },
        seed: hashSeed(bar.symbol, session.currentMarketDate, session.cycle),
      });
      const path = resampleCloses(sim.closes, tickCount);
      paths.set(bar.symbol, path);
      const last = path[0]!;
      quotes.push({
        symbol: bar.symbol,
        name: meta.name,
        exchange: 'NSE',
        sector: meta.sector,
        open: bar.open,
        close: bar.close,
        lastPrice: last,
        previousClose: bar.previousClose,
        dayChangePct: roundPrice(((last - bar.previousClose) / bar.previousClose) * 100),
        tickIndex: 0,
        tickCount,
      });
    } catch {
      // Skip symbols the agent cannot price
    }
  }

  if (quotes.length === 0) {
    throw Object.assign(new Error('No priced symbols available for this market date'), {
      status: 502,
    });
  }

  const now = Date.now();
  session.status = 'TRADING';
  session.tickIndex = 0;
  session.tickCount = tickCount;
  session.quotes = quotes;
  session.dayStartedAt = new Date(now).toISOString();
  session.dayEndsAt = new Date(now + dayMs).toISOString();
  session.analysisEndsAt = null;
  saveSession(session);

  runtime = {
    sessionId,
    paths,
    tickTimer: null,
    dayTimer: null,
    analysisTimer: null,
  };

  runtime.tickTimer = setInterval(() => {
    void advanceTick(sessionId);
  }, tickMs);

  runtime.dayTimer = setTimeout(() => {
    void enterAnalysis(sessionId);
  }, dayMs);
}

async function advanceTick(sessionId: string): Promise<void> {
  const session = getSession(sessionId);
  if (!session || !runtime || session.status !== 'TRADING') return;

  const nextIndex = Math.min(session.tickIndex + 1, session.tickCount - 1);
  session.tickIndex = nextIndex;
  session.quotes = session.quotes.map((q) => {
    const path = runtime!.paths.get(q.symbol);
    const lastPrice = path ? path[nextIndex]! : q.lastPrice;
    return {
      ...q,
      lastPrice,
      dayChangePct: roundPrice(((lastPrice - q.previousClose) / q.previousClose) * 100),
      tickIndex: nextIndex,
    };
  });
  saveSession(session);
}

async function enterAnalysis(sessionId: string): Promise<void> {
  stopRuntimeTimers({ keepAnalysis: true });

  const session = getSession(sessionId);
  if (!session || session.status === 'ENDED') return;

  if (runtime) {
    session.quotes = session.quotes.map((q) => {
      const path = runtime!.paths.get(q.symbol);
      const lastPrice = path ? path[path.length - 1]! : q.close;
      return {
        ...q,
        lastPrice,
        dayChangePct: roundPrice(((lastPrice - q.previousClose) / q.previousClose) * 100),
        tickIndex: session.tickCount - 1,
      };
    });
  }

  const analysisMs = Math.max(
    5_000,
    Math.round(session.secondsPerMarketMinute * 1000 * 5),
  );
  session.status = 'ANALYSIS';
  session.tickIndex = session.tickCount - 1;
  session.analysisEndsAt = new Date(Date.now() + analysisMs).toISOString();
  saveSession(session);

  for (const account of getAllAccounts()) {
    const invested = account.holdings.reduce((sum, h) => {
      const q = session.quotes.find((x) => x.symbol === h.symbol);
      return sum + h.units * (q?.lastPrice ?? h.averageCost);
    }, 0);
    const snap = {
      date: session.currentMarketDate,
      cashBalance: account.user.cashBalance,
      investedValue: roundPrice(invested),
      totalValue: roundPrice(account.user.cashBalance + invested),
    };
    const hist = [...account.growthHistory];
    const last = hist[hist.length - 1];
    if (last?.date === snap.date) hist[hist.length - 1] = snap;
    else hist.push(snap);
    account.growthHistory = hist;
    account.nextSimulationDate = nextTradingDay(session.currentMarketDate);
    await persistAccount(account);
  }

  runtime = {
    sessionId,
    paths: runtime?.paths ?? new Map(),
    tickTimer: null,
    dayTimer: null,
    analysisTimer: setTimeout(() => {
      const s = getSession(sessionId);
      if (s && s.status === 'ANALYSIS') {
        s.analysisEndsAt = new Date().toISOString();
        saveSession(s);
      }
    }, analysisMs),
  };
}

export async function executeLiveOrder(userId: string, order: Order): Promise<{
  order: Order;
  account: UserAccount;
  session: SimulationSession;
}> {
  const session = getGlobalSession();
  if (!session || session.status !== 'TRADING') {
    throw Object.assign(new Error('Live orders only allowed during a trading day'), { status: 400 });
  }
  const price = session.quotes.find((q) => q.symbol === order.symbol)?.lastPrice ?? null;
  if (price == null) {
    throw Object.assign(new Error('Symbol not on the simulation board'), { status: 400 });
  }

  const account = await getAccount(userId);
  order.simulationCycle = session.cycle;
  applyFill(account, order, price, session.currentMarketDate, 'Live simulation fill');
  await persistAccount(account);
  return { order, account, session };
}

function stopRuntimeTimers(opts?: { keepAnalysis?: boolean }): void {
  if (!runtime) return;
  if (runtime.tickTimer) clearInterval(runtime.tickTimer);
  if (runtime.dayTimer) clearTimeout(runtime.dayTimer);
  if (!opts?.keepAnalysis && runtime.analysisTimer) clearTimeout(runtime.analysisTimer);
  runtime.tickTimer = null;
  runtime.dayTimer = null;
  if (!opts?.keepAnalysis) {
    runtime.analysisTimer = null;
    runtime = null;
  }
}

/** User-facing start/stop blocked */
export async function startSimulation(_userId: string): Promise<never> {
  throw Object.assign(new Error('Only admin can begin a simulation'), { status: 403 });
}

export async function continueSimulation(_userId: string): Promise<never> {
  throw Object.assign(new Error('Only admin can continue a simulation'), { status: 403 });
}

export async function stopSimulation(_userId: string): Promise<never> {
  throw Object.assign(new Error('Only admin can end a simulation'), { status: 403 });
}
