export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
export type OrderKind = 'PRE_SIMULATION' | 'LIVE';

/** Session lifecycle for a simulation run. */
export type SimulationStatus =
  | 'IDLE'
  | 'TRADING'
  | 'ANALYSIS'
  | 'ENDED';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  cashBalance: number;
  createdAt: string;
}

export interface Holding {
  symbol: string;
  units: number;
  averageCost: number;
}

export interface LedgerEntry {
  id: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  units: number;
  price: number;
  amount: number;
  simulationCycle: number | null;
  marketDate: string | null;
  orderId: string | null;
  createdAt: string;
  note?: string;
}

export interface Order {
  id: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  units: number;
  kind: OrderKind;
  status: OrderStatus;
  simulationCycle: number | null;
  fillPrice: number | null;
  placedAt: string;
  filledAt: string | null;
}

export interface PortfolioSnapshot {
  date: string;
  totalValue: number;
  cashBalance: number;
  investedValue: number;
}

export interface DayBar {
  symbol: string;
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  previousClose: number;
  vwap: number;
  last?: number;
  volume?: number;
  turnover?: number;
  trades?: number;
  deliverableVolume?: number;
  deliverablePct?: number;
}

export interface LiveQuote {
  symbol: string;
  name: string;
  exchange: 'NSE';
  sector: string;
  open: number;
  close: number;
  lastPrice: number;
  previousClose: number;
  dayChangePct: number;
  tickIndex: number;
  tickCount: number;
}

export interface SimulationSession {
  id: string;
  /** Always `global` for the admin-controlled market session. */
  userId: string;
  status: SimulationStatus;
  startMarketDate: string;
  currentMarketDate: string;
  /** 1-based day index within this session (max 10). */
  cycle: number;
  maxCycles: number;
  dayStartedAt: string | null;
  dayEndsAt: string | null;
  analysisEndsAt: string | null;
  tickIndex: number;
  tickCount: number;
  quotes: LiveQuote[];
  /** Admin-configured: wall seconds per market minute (default 5). */
  secondsPerMarketMinute: number;
  updatedAt: string;
  version: number;
}

export interface UserAccount {
  user: UserProfile;
  holdings: Holding[];
  orders: Order[];
  ledger: LedgerEntry[];
  growthHistory: PortfolioSnapshot[];
  /** ISO date of the most recent filled BUY, if any. */
  latestBuyDate: string | null;
  /** Next simulation start candidate when idle. */
  nextSimulationDate: string;
  passwordHash: string;
}

export const MAX_SIMULATION_DAYS = 10;
export const EMPTY_PORTFOLIO_START_DATE = '2008-01-01';
export const NSE_MINUTES_PER_DAY = 375;

/** @deprecated Limits removed — kept as Infinity for any leftover checks. */
export const MAX_PORTFOLIO_HOLDINGS = Number.POSITIVE_INFINITY;
/** @deprecated Board is the full catalog. */
export const SIMULATION_MARKET_SIZE = Number.POSITIVE_INFINITY;

/** Wall-clock duration of one simulated market day (before time scale). */
export const MARKET_DAY_MS = (31 *60 * 60 + 15) * 1000;
/** Price refresh interval during a trading day (before time scale). */
export const PRICE_TICK_MS = 5 * 1000;
/** Analysis window after each day (before time scale). */
export const ANALYSIS_MS = 5 * 60 * 1000;
