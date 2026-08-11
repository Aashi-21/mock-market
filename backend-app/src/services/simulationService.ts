import { config } from '../config.js';
import {
  ANALYSIS_MS,
  EMPTY_PORTFOLIO_START_DATE,
  MARKET_DAY_MS,
  MAX_SIMULATION_DAYS,
  PRICE_TICK_MS,
  SIMULATION_MARKET_SIZE,
  type LiveQuote,
  type Order,
  type SimulationSession,
  type UserAccount,
} from '../types/index.js';
import { fetchDayBars, getStockMeta, getNiftyPool } from '../stubs/stockPriceApi.js';
import {
  clearSession,
  createSession,
  getAccount,
  getSession,
  getSessionByUser,
  persistAccount,
  saveSession,
} from '../store/memoryStore.js';
import { applyFill, nonZeroHoldings } from './portfolioMath.js';
import { fetchIntradayPath, resampleCloses } from './simulationAgentClient.js';
import { nextTradingDay, roundPrice } from '../utils/helpers.js';

interface DayRuntime {
  sessionId: string;
  paths: Map<string, number[]>;
  tickTimer: NodeJS.Timeout | null;
  dayTimer: NodeJS.Timeout | null;
  analysisTimer: NodeJS.Timeout | null;
}

const runtimes = new Map<string, DayRuntime>();

function scaled(ms: number): number {
  return Math.max(50, Math.round(ms / config.simulationTimeScale));
}

export function resolveSimulationStartDate(account: UserAccount): string {
  if (nonZeroHoldings(account.holdings).length === 0 && !account.latestBuyDate) {
    return EMPTY_PORTFOLIO_START_DATE;
  }
  const anchor = account.latestBuyDate ?? account.nextSimulationDate ?? EMPTY_PORTFOLIO_START_DATE;
  return nextTradingDay(anchor);
}

export function buildUniverse(account: UserAccount): string[] {
  const required = nonZeroHoldings(account.holdings).map((h) => h.symbol);
  const selected: string[] = [];
  for (const symbol of required) {
    if (getStockMeta(symbol) && !selected.includes(symbol)) selected.push(symbol);
  }
  for (const meta of getNiftyPool().filter((m) => m.hasCsv)) {
    if (selected.length >= SIMULATION_MARKET_SIZE) break;
    if (!selected.includes(meta.symbol)) selected.push(meta.symbol);
  }
  for (const meta of getNiftyPool()) {
    if (selected.length >= SIMULATION_MARKET_SIZE) break;
    if (!selected.includes(meta.symbol)) selected.push(meta.symbol);
  }
  return selected.slice(0, SIMULATION_MARKET_SIZE);
}

export async function startSimulation(userId: string): Promise<SimulationSession> {
  const existing = getSessionByUser(userId);
  if (existing && (existing.status === 'TRADING' || existing.status === 'ANALYSIS')) {
    throw Object.assign(new Error('Simulation already active'), { status: 409 });
  }

  const account = await getAccount(userId);
  const startDate = resolveSimulationStartDate(account);

  // Execute pending pre-simulation orders at opening prices for startDate
  const pending = account.orders.filter((o) => o.kind === 'PRE_SIMULATION' && o.status === 'PENDING');
  if (pending.length > 0) {
    const symbols = [...new Set(pending.map((o) => o.symbol))];
    const bars = await fetchDayBars(symbols, startDate);
    const openBySymbol = new Map(bars.map((b) => [b.symbol, b.open]));
    for (const order of pending) {
      const open = openBySymbol.get(order.symbol);
      if (open == null) {
        order.status = 'REJECTED';
        continue;
      }
      try {
        applyFill(account, order, open, startDate, 'Pre-simulation fill at open');
        order.simulationCycle = 1;
      } catch {
        order.status = 'REJECTED';
      }
    }
    await persistAccount(account);
  }

  const session = createSession({
    userId,
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
  });

  await beginTradingDay(session.id);
  return getSession(session.id)!;
}

async function beginTradingDay(sessionId: string): Promise<void> {
  stopRuntimeTimers(sessionId);

  const session = getSession(sessionId);
  if (!session) return;

  const account = await getAccount(session.userId);
  const symbols = buildUniverse(account);
  const bars = await fetchDayBars(symbols, session.currentMarketDate);

  const dayMs = scaled(MARKET_DAY_MS);
  const tickMs = scaled(PRICE_TICK_MS);
  const tickCount = Math.max(2, Math.floor(dayMs / tickMs));

  const paths = new Map<string, number[]>();
  const quotes: LiveQuote[] = [];

  for (const bar of bars) {
    const meta = getStockMeta(bar.symbol)!;
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
    const last = path[0];
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

  const runtime: DayRuntime = {
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

  runtimes.set(sessionId, runtime);
}

async function advanceTick(sessionId: string): Promise<void> {
  const session = getSession(sessionId);
  const runtime = runtimes.get(sessionId);
  if (!session || !runtime || session.status !== 'TRADING') return;

  const nextIndex = Math.min(session.tickIndex + 1, session.tickCount - 1);
  session.tickIndex = nextIndex;
  session.quotes = session.quotes.map((q) => {
    const path = runtime.paths.get(q.symbol);
    const lastPrice = path ? path[nextIndex] : q.lastPrice;
    return {
      ...q,
      lastPrice,
      dayChangePct: roundPrice(((lastPrice - q.previousClose) / q.previousClose) * 100),
      tickIndex: nextIndex,
    };
  });
  saveSession(session);

  if (nextIndex >= session.tickCount - 1) {
    // Final tick reached early — analysis will still fire from dayTimer
  }
}

async function enterAnalysis(sessionId: string): Promise<void> {
  stopRuntimeTimers(sessionId, { keepAnalysis: true });

  const session = getSession(sessionId);
  if (!session || session.status === 'ENDED') return;

  const runtime = runtimes.get(sessionId);
  // Snap all quotes to official close
  if (runtime) {
    session.quotes = session.quotes.map((q) => {
      const path = runtime.paths.get(q.symbol);
      const lastPrice = path ? path[path.length - 1] : q.close;
      return {
        ...q,
        lastPrice,
        dayChangePct: roundPrice(((lastPrice - q.previousClose) / q.previousClose) * 100),
        tickIndex: session.tickCount - 1,
      };
    });
  }

  const analysisMs = scaled(ANALYSIS_MS);
  session.status = 'ANALYSIS';
  session.tickIndex = session.tickCount - 1;
  session.analysisEndsAt = new Date(Date.now() + analysisMs).toISOString();
  saveSession(session);

  const account = await getAccount(session.userId);
  // Mark portfolio to closing prices via snapshot
  for (const q of session.quotes) {
    const holding = account.holdings.find((h) => h.symbol === q.symbol);
    if (holding) {
      // ledger note via synthetic mark — snapshot uses last ledger; push mark prices into snapshot helper
    }
  }
  // Update growth snapshot using close prices
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

  const rt = runtimes.get(sessionId) ?? {
    sessionId,
    paths: new Map(),
    tickTimer: null,
    dayTimer: null,
    analysisTimer: null,
  };
  rt.analysisTimer = setTimeout(() => {
    // Auto-continue if under max days; else end
    void autoProgressAfterAnalysis(sessionId);
  }, analysisMs);
  runtimes.set(sessionId, rt);
}

async function autoProgressAfterAnalysis(sessionId: string): Promise<void> {
  const session = getSession(sessionId);
  if (!session || session.status !== 'ANALYSIS') return;
  if (session.cycle >= session.maxCycles) {
    await stopSimulation(session.userId);
    return;
  }
  // Stay in analysis until user continues or stops — do not auto-continue.
  // Timer expiry simply flags analysis ended by leaving status ANALYSIS with past analysisEndsAt.
  session.analysisEndsAt = new Date().toISOString();
  saveSession(session);
}

export async function continueSimulation(userId: string): Promise<SimulationSession> {
  const session = getSessionByUser(userId);
  if (!session || session.status !== 'ANALYSIS') {
    throw Object.assign(new Error('No analysis window active to continue'), { status: 400 });
  }
  if (session.cycle >= session.maxCycles) {
    throw Object.assign(new Error('Maximum of 10 simulation days reached'), { status: 400 });
  }

  session.cycle += 1;
  session.currentMarketDate = nextTradingDay(session.currentMarketDate);
  saveSession(session);
  await beginTradingDay(session.id);
  return getSession(session.id)!;
}

export async function stopSimulation(userId: string): Promise<{
  session: SimulationSession;
  account: UserAccount;
}> {
  const session = getSessionByUser(userId);
  if (!session) {
    throw Object.assign(new Error('No active simulation'), { status: 404 });
  }

  stopRuntimeTimers(session.id);
  session.status = 'ENDED';
  session.dayEndsAt = session.dayEndsAt ?? new Date().toISOString();
  session.analysisEndsAt = null;
  saveSession(session);

  const account = await getAccount(userId);
  account.nextSimulationDate = nextTradingDay(session.currentMarketDate);
  await persistAccount(account);

  // Keep ended session briefly for final poll, then clear mapping after response
  const ended = getSession(session.id)!;
  clearSession(userId);
  // Re-save ended snapshot without user mapping? Client gets response body.
  return { session: ended, account };
}

export function getLiveQuotePrice(session: SimulationSession, symbol: string): number | null {
  return session.quotes.find((q) => q.symbol === symbol)?.lastPrice ?? null;
}

export async function executeLiveOrder(userId: string, order: Order): Promise<{
  order: Order;
  account: UserAccount;
  session: SimulationSession;
}> {
  const session = getSessionByUser(userId);
  if (!session || session.status !== 'TRADING') {
    throw Object.assign(new Error('Live orders only allowed during a trading day'), { status: 400 });
  }
  const price = getLiveQuotePrice(session, order.symbol);
  if (price == null) {
    throw Object.assign(new Error('Symbol not on the simulation board'), { status: 400 });
  }

  const account = await getAccount(userId);
  order.simulationCycle = session.cycle;
  applyFill(account, order, price, session.currentMarketDate, 'Live simulation fill');
  await persistAccount(account);
  return { order, account, session };
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

function stopRuntimeTimers(
  sessionId: string,
  opts?: { keepAnalysis?: boolean },
): void {
  const rt = runtimes.get(sessionId);
  if (!rt) return;
  if (rt.tickTimer) clearInterval(rt.tickTimer);
  if (rt.dayTimer) clearTimeout(rt.dayTimer);
  if (!opts?.keepAnalysis && rt.analysisTimer) clearTimeout(rt.analysisTimer);
  rt.tickTimer = null;
  rt.dayTimer = null;
  if (!opts?.keepAnalysis) {
    rt.analysisTimer = null;
    runtimes.delete(sessionId);
  }
}
