/**
 * Stub: Historical stock price API.
 * Returns open/close (and high/low) for a symbol on a given market date.
 * Replace fetch body with the real provider once credentials arrive.
 */

import { config } from '../config.js';
import type { DayBar } from '../types/index.js';
import { roundPrice } from '../utils/helpers.js';

export interface StockMeta {
  symbol: string;
  name: string;
  sector: string;
  /** Approximate 2008-era baseline for deterministic mock series. */
  base2008: number;
}

export const NIFTY_POOL: StockMeta[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', sector: 'Oil & Gas', base2008: 720 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT', base2008: 480 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', sector: 'Banking', base2008: 310 },
  { symbol: 'INFY', name: 'Infosys Ltd', sector: 'IT', base2008: 420 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', sector: 'Banking', base2008: 280 },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', sector: 'FMCG', base2008: 220 },
  { symbol: 'ITC', name: 'ITC Ltd', sector: 'FMCG', base2008: 95 },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'Banking', base2008: 180 },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', sector: 'Telecom', base2008: 350 },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd', sector: 'Infrastructure', base2008: 640 },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd', sector: 'Banking', base2008: 210 },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', sector: 'Banking', base2008: 190 },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', sector: 'NBFC', base2008: 45 },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd', sector: 'Consumer', base2008: 260 },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', sector: 'Automobile', base2008: 890 },
];

export function getStockMeta(symbol: string): StockMeta | undefined {
  return NIFTY_POOL.find((s) => s.symbol === symbol);
}

function dayIndexFromEpoch(date: string): number {
  const start = Date.parse('2008-01-01T00:00:00.000Z');
  const current = Date.parse(`${date}T00:00:00.000Z`);
  return Math.max(0, Math.round((current - start) / 86_400_000));
}

function previousCalendarDate(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function pseudoLevel(base: number, date: string, symbol: string): number {
  const day = dayIndexFromEpoch(date);
  const symHash = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0);
  const drift = 1 + day * 0.00035 + Math.sin((day + symHash) / 11) * 0.02;
  const shock = 1 + Math.sin((day * 1.7 + symHash) / 5) * 0.012;
  return roundPrice(Math.max(5, base * drift * shock));
}

export async function fetchDayBar(symbol: string, date: string): Promise<DayBar> {
  // TODO(stock-api): HTTP GET to provider using STOCK_DATA_API_KEY
  void config.stockDataApiKey;

  const meta = getStockMeta(symbol);
  if (!meta) {
    throw Object.assign(new Error(`Unknown symbol: ${symbol}`), { status: 404 });
  }

  const prev = previousCalendarDate(date);
  const previousClose = pseudoLevel(meta.base2008, prev, symbol);
  const gap = ((dayIndexFromEpoch(date) + symbol.length) % 7 - 3) * 0.0015;
  const open = roundPrice(previousClose * (1 + gap));
  const close = pseudoLevel(meta.base2008, date, symbol);
  const high = roundPrice(Math.max(open, close) * 1.008);
  const low = roundPrice(Math.min(open, close) * 0.992);

  return { symbol, date, open, close, high, low };
}

export async function fetchDayBars(symbols: string[], date: string): Promise<DayBar[]> {
  return Promise.all(symbols.map((s) => fetchDayBar(s, date)));
}
