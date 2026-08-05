import type { Holding, Order, PortfolioSnapshot, User } from '../types';
import { LATEST_MARKET_DATE } from './mockMarket';

/** Mock credentials for local development until IDAM is wired. */
export const MOCK_CREDENTIALS = {
  email: 'trader@mockmarket.in',
  password: 'demo1234',
} as const;

export const MOCK_USER: User = {
  id: 'usr_mock_001',
  email: MOCK_CREDENTIALS.email,
  displayName: 'Aarav Mehta',
  cashBalance: 250000,
};

export const MOCK_HOLDINGS: Holding[] = [
  { symbol: 'RELIANCE', units: 15, averageCost: 2750.0 },
  { symbol: 'INFY', units: 40, averageCost: 1620.5 },
];

/** Portfolio total value history ending at the latest available market date. */
export const MOCK_GROWTH_HISTORY: PortfolioSnapshot[] = [
  { date: '2024-11-29', totalValue: 312400, cashBalance: 250000, investedValue: 62400 },
  { date: '2024-12-06', totalValue: 318900, cashBalance: 250000, investedValue: 68900 },
  { date: '2024-12-13', totalValue: 325150, cashBalance: 250000, investedValue: 75150 },
  { date: '2024-12-20', totalValue: 331800, cashBalance: 250000, investedValue: 81800 },
  { date: LATEST_MARKET_DATE, totalValue: 336850, cashBalance: 250000, investedValue: 86850 },
];

export const MOCK_PENDING_ORDERS: Order[] = [];
