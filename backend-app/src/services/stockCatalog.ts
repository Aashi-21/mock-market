/**
 * Shared stock catalog from DATA/stock_metadata.csv (same file as simulation-agent).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

export interface CatalogStock {
  symbol: string;
  name: string;
  industry: string;
  series: string;
  isin: string;
  exchange: 'NSE';
  hasCsv: boolean;
  csvPath: string | null;
}

function dataDir(): string {
  if (config.dataDir) return resolve(config.dataDir);
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '../../../DATA');
}

function candidateCsvNames(symbol: string): string[] {
  const variants = [
    symbol,
    symbol.replaceAll('&', ''),
    symbol.replaceAll('-', ''),
    symbol.replaceAll('&', '').replaceAll('-', ''),
    symbol.replaceAll('&', 'AND'),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of variants) {
    const name = `${v}.csv`;
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

export function resolveStockCsv(symbol: string): string | null {
  const dir = dataDir();
  for (const name of candidateCsvNames(symbol)) {
    const path = resolve(dir, name);
    if (existsSync(path)) return path;
  }
  return null;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

let cached: CatalogStock[] | null = null;

export function loadStockCatalog(force = false): CatalogStock[] {
  if (cached && !force) return cached;
  const path = resolve(dataDir(), 'stock_metadata.csv');
  if (!existsSync(path)) {
    cached = [];
    return cached;
  }
  const text = readFileSync(path, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    cached = [];
    return cached;
  }
  const header = parseCsvLine(lines[0]!).map((h) => h.trim());
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = header.findIndex((h) => h.toLowerCase() === n.toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };
  const iName = idx(['Company Name', 'Name']);
  const iInd = idx(['Industry', 'Sector']);
  const iSym = idx(['Symbol']);
  const iSeries = idx(['Series', 'Type']);
  const iIsin = idx(['ISIN Code', 'ISIN']);
  if (iSym < 0 || iName < 0) {
    cached = [];
    return cached;
  }

  const rows: CatalogStock[] = [];
  for (let li = 1; li < lines.length; li += 1) {
    const cells = parseCsvLine(lines[li]!);
    const symbol = cells[iSym]?.trim();
    if (!symbol) continue;
    const csvPath = resolveStockCsv(symbol);
    rows.push({
      symbol,
      name: cells[iName]?.trim() ?? symbol,
      industry: iInd >= 0 ? (cells[iInd]?.trim() ?? '') : '',
      series: iSeries >= 0 ? (cells[iSeries]?.trim() || 'EQ') : 'EQ',
      isin: iIsin >= 0 ? (cells[iIsin]?.trim() ?? '') : '',
      exchange: 'NSE',
      hasCsv: csvPath != null,
      csvPath,
    });
  }
  rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
  cached = rows;
  return rows;
}

export function getCatalogStock(symbol: string): CatalogStock | undefined {
  return loadStockCatalog().find((s) => s.symbol === symbol);
}

export function listCatalogStocks(opts?: { series?: string; industry?: string }): CatalogStock[] {
  let rows = loadStockCatalog();
  if (opts?.series) {
    const s = opts.series.toUpperCase();
    rows = rows.filter((r) => r.series.toUpperCase() === s);
  }
  if (opts?.industry) {
    const ind = opts.industry.toUpperCase();
    rows = rows.filter((r) => r.industry.toUpperCase() === ind);
  }
  return rows;
}
