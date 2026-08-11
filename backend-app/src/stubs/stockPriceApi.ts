/**
 * Historical day bars: prefer DATA/{SYMBOL}.csv, else deterministic pseudo series.
 */

import { readFileSync, existsSync } from 'node:fs';
import { config } from '../config.js';
import type { DayBar } from '../types/index.js';
import { roundPrice } from '../utils/helpers.js';
import {
  getCatalogStock,
  listCatalogStocks,
  resolveStockCsv,
  type CatalogStock,
} from '../services/stockCatalog.js';

export type StockMeta = CatalogStock & { sector: string; base2008: number };

/** @deprecated use listCatalogStocks — kept as alias for simulation universe fill */
export function getNiftyPool(): StockMeta[] {
  return listCatalogStocks().map(toStockMeta);
}

export const NIFTY_POOL: StockMeta[] = []; // populated lazily via getNiftyPool()

export function getStockMeta(symbol: string): StockMeta | undefined {
  const row = getCatalogStock(symbol);
  return row ? toStockMeta(row) : undefined;
}

function toStockMeta(row: CatalogStock): StockMeta {
  const hash = [...row.symbol].reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    ...row,
    sector: row.industry,
    base2008: 50 + (hash % 900),
  };
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

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '';
    let q = false;
    for (const ch of line) {
      if (ch === '"') {
        q = !q;
        continue;
      }
      if (ch === ',' && !q) {
        cells.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  };
  const header = parseLine(lines[0] ?? '');
  const rows = lines.slice(1).map(parseLine);
  return { header, rows };
}

function colIndex(header: string[], names: string[]): number {
  for (const n of names) {
    const i = header.findIndex((h) => h.toLowerCase() === n.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function num(cell: string | undefined): number | null {
  if (cell == null || cell.trim() === '') return null;
  const n = Number(cell.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

interface CsvDayRow {
  date: string;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  last: number;
  close: number;
  vwap: number;
  volume?: number;
  turnover?: number;
  trades?: number;
  deliverableVolume?: number;
  deliverablePct?: number;
}

function loadCsvDays(symbol: string): CsvDayRow[] {
  const path = resolveStockCsv(symbol);
  if (!path || !existsSync(path)) return [];
  const { header, rows } = parseCsv(readFileSync(path, 'utf8'));
  const iDate = colIndex(header, ['Date']);
  const iPrev = colIndex(header, ['Prev Close', 'PreviousClose', 'PrevClose']);
  const iOpen = colIndex(header, ['Open']);
  const iHigh = colIndex(header, ['High']);
  const iLow = colIndex(header, ['Low']);
  const iLast = colIndex(header, ['Last']);
  const iClose = colIndex(header, ['Close']);
  const iVwap = colIndex(header, ['VWAP']);
  const iVol = colIndex(header, ['Volume']);
  const iTurn = colIndex(header, ['Turnover']);
  const iTrades = colIndex(header, ['Trades']);
  const iDelVol = colIndex(header, ['Deliverable Volume', 'DeliverableVolume']);
  const iDelPct = colIndex(header, ['%Deliverble', '%Deliverable', 'DeliverablePct']);
  if ([iDate, iPrev, iOpen, iHigh, iLow, iLast, iClose, iVwap].some((i) => i < 0)) return [];

  const out: CsvDayRow[] = [];
  for (const r of rows) {
    const date = (r[iDate] ?? '').slice(0, 10);
    const previousClose = num(r[iPrev]);
    const open = num(r[iOpen]);
    const high = num(r[iHigh]);
    const low = num(r[iLow]);
    const last = num(r[iLast]);
    const close = num(r[iClose]);
    const vwap = num(r[iVwap]);
    if (!date || [previousClose, open, high, low, last, close, vwap].some((x) => x == null)) continue;
    let deliverablePct = iDelPct >= 0 ? num(r[iDelPct]) ?? undefined : undefined;
    if (deliverablePct != null && deliverablePct > 1) deliverablePct /= 100;
    out.push({
      date,
      previousClose: previousClose!,
      open: open!,
      high: high!,
      low: low!,
      last: last!,
      close: close!,
      vwap: vwap!,
      volume: iVol >= 0 ? num(r[iVol]) ?? undefined : undefined,
      turnover: iTurn >= 0 ? num(r[iTurn]) ?? undefined : undefined,
      trades: iTrades >= 0 ? num(r[iTrades]) ?? undefined : undefined,
      deliverableVolume: iDelVol >= 0 ? num(r[iDelVol]) ?? undefined : undefined,
      deliverablePct,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

function pickCsvDay(symbol: string, date: string): CsvDayRow | null {
  const days = loadCsvDays(symbol);
  if (days.length === 0) return null;
  const exact = days.find((d) => d.date === date);
  if (exact) return exact;
  // Prefer latest on or before date; else earliest after
  const before = [...days].reverse().find((d) => d.date <= date);
  if (before) return before;
  return days[0] ?? null;
}

function pseudoDayBar(symbol: string, date: string, meta: StockMeta): DayBar {
  const prev = previousCalendarDate(date);
  const previousClose = pseudoLevel(meta.base2008, prev, symbol);
  const gap = ((dayIndexFromEpoch(date) + symbol.length) % 7 - 3) * 0.0015;
  const open = roundPrice(previousClose * (1 + gap));
  const close = pseudoLevel(meta.base2008, date, symbol);
  const high = roundPrice(Math.max(open, close) * 1.008);
  const low = roundPrice(Math.min(open, close) * 0.992);
  const mid = (open + close + high + low) / 4;
  const vwap = roundPrice(mid * (1 + ((dayIndexFromEpoch(date) % 5) - 2) * 0.0008));
  const last = roundPrice(close * (1 + ((symbol.length % 3) - 1) * 0.0005));
  const day = dayIndexFromEpoch(date);
  const volume = Math.round(120_000 + (day % 17) * 18_500 + symbol.length * 4_200);
  const trades = Math.round(volume / 45);
  const deliverablePct = Math.min(0.85, Math.max(0.45, 0.55 + ((day + symbol.length) % 9) * 0.03));
  const deliverableVolume = Math.round(volume * deliverablePct);
  const turnover = volume * vwap * 1e5;
  return {
    symbol,
    date,
    open,
    close,
    high,
    low,
    previousClose,
    vwap,
    last,
    volume,
    turnover,
    trades,
    deliverableVolume,
    deliverablePct,
  };
}

export async function fetchDayBar(symbol: string, date: string): Promise<DayBar> {
  void config.stockDataApiKey;
  const meta = getStockMeta(symbol);
  if (!meta) {
    throw Object.assign(new Error(`Unknown symbol: ${symbol}`), { status: 404 });
  }

  const csv = pickCsvDay(symbol, date);
  if (csv) {
    return {
      symbol,
      date,
      open: csv.open,
      close: csv.close,
      high: csv.high,
      low: csv.low,
      previousClose: csv.previousClose,
      vwap: csv.vwap,
      last: csv.last,
      volume: csv.volume,
      turnover: csv.turnover,
      trades: csv.trades,
      deliverableVolume: csv.deliverableVolume,
      deliverablePct: csv.deliverablePct,
    };
  }

  return pseudoDayBar(symbol, date, meta);
}

export async function fetchDayBars(symbols: string[], date: string): Promise<DayBar[]> {
  return Promise.all(symbols.map((s) => fetchDayBar(s, date)));
}
