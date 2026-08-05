/** Shared domain types aligned with backend-app API contracts. */

export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
export type OrderKind = 'PRE_SIMULATION' | 'LIVE';

/** Client-facing phase derived from backend session status. */
export type SimulationPhase =
  | 'PRE_SIMULATION'
  | 'TRADING'
  | 'ANALYSIS'
  | 'ENDED';

export type SimulationStatus = 'IDLE' | 'TRADING' | 'ANALYSIS' | 'ENDED';

export interface User {
  id: string;
  email: string;
  displayName: string;
  cashBalance: number;
  createdAt?: string;
}

export interface Stock {
  symbol: string;
  name: string;
  exchange: 'NSE';
  sector: string;
  lastPrice: number;
  previousClose: number;
  dayChangePct: number;
  open?: number;
  close?: number;
}

export interface Holding {
  symbol: string;
  units: number;
  averageCost: number;
}

export interface PortfolioSnapshot {
  date: string;
  totalValue: number;
  cashBalance: number;
  investedValue: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  units: number;
  kind: OrderKind;
  status: OrderStatus;
  simulationCycle: number | null;
  fillPrice: number | null;
  placedAt: string;
  filledAt: string | null;
  /** @deprecated prefer kind === 'PRE_SIMULATION' */
  isPreSimulation?: boolean;
  limitPrice?: number;
}

export interface LedgerEntry {
  id: string;
  symbol: string;
  side: OrderSide;
  units: number;
  price: number;
  amount: number;
  simulationCycle: number | null;
  marketDate: string | null;
  createdAt: string;
  note?: string;
}

export interface Portfolio {
  holdings: Holding[];
  cashBalance: number;
  growthHistory: PortfolioSnapshot[];
}

export interface LiveQuote extends Stock {
  open: number;
  close: number;
  tickIndex: number;
  tickCount: number;
}

export interface SimulationSession {
  id: string;
  userId: string;
  status: SimulationStatus;
  startMarketDate: string;
  currentMarketDate: string;
  cycle: number;
  maxCycles: number;
  dayStartedAt: string | null;
  dayEndsAt: string | null;
  analysisEndsAt: string | null;
  tickIndex: number;
  tickCount: number;
  quotes: LiveQuote[];
  updatedAt: string;
  version: number;
}

export interface AuthSession {
  user: User;
  token: string;
}

export const MAX_PORTFOLIO_HOLDINGS = 3;
export const SIMULATION_MARKET_SIZE = 10;
