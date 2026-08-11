/**
 * Cleartext local file DB (gitignored). Not for production.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  Holding,
  LedgerEntry,
  Order,
  PortfolioSnapshot,
  UserAccount,
  UserProfile,
} from '../types/index.js';
import { EMPTY_PORTFOLIO_START_DATE } from '../types/index.js';
import { config } from '../config.js';

const RESERVED_ADMIN = 'rootadmin';

export function localDbRoot(): string {
  if (config.localDbDir) return resolve(config.localDbDir);
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '../../local-db');
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function usersCsvPath(): string {
  return resolve(localDbRoot(), 'users.csv');
}

function userDir(userId: string): string {
  return resolve(localDbRoot(), 'users', userId);
}

function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
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
  });
}

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(path: string, header: string[], rows: (string | number | null | undefined)[][]): void {
  ensureDir(dirname(path));
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  writeFileSync(path, `${lines.join('\n')}\n`, 'utf8');
}

export function isReservedUsername(username: string): boolean {
  return username.trim().toLowerCase() === RESERVED_ADMIN;
}

export function validateUsername(username: string): string {
  const id = username.trim();
  if (!id) throw Object.assign(new Error('Username is required'), { status: 400 });
  if (isReservedUsername(id)) {
    throw Object.assign(new Error('Username is reserved'), { status: 400 });
  }
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(id)) {
    throw Object.assign(
      new Error('Username must be 3–32 chars: letters, numbers, underscore'),
      { status: 400 },
    );
  }
  return id;
}

interface UserRow {
  userId: string;
  password: string;
  displayName: string;
  cashBalance: number;
  createdAt: string;
  latestBuyDate: string;
  nextSimulationDate: string;
}

function readUserRows(): UserRow[] {
  const path = usersCsvPath();
  if (!existsSync(path)) return [];
  const rows = parseCsv(readFileSync(path, 'utf8'));
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());
  const iId = idx('userid');
  const iPw = idx('password');
  const iName = idx('displayname');
  const iCash = idx('cashbalance');
  const iCreated = idx('createdat');
  const iBuy = idx('latestbuydate');
  const iNext = idx('nextsimulationdate');
  if (iId < 0 || iPw < 0) return [];

  return rows.slice(1).map((r) => ({
    userId: r[iId] ?? '',
    password: r[iPw] ?? '',
    displayName: r[iName] ?? r[iId] ?? '',
    cashBalance: Number(r[iCash] ?? 0) || 0,
    createdAt: r[iCreated] ?? new Date().toISOString(),
    latestBuyDate: r[iBuy] ?? '',
    nextSimulationDate: r[iNext] || EMPTY_PORTFOLIO_START_DATE,
  })).filter((u) => u.userId);
}

function writeUserRows(rows: UserRow[]): void {
  writeCsv(
    usersCsvPath(),
    [
      'userId',
      'password',
      'displayName',
      'cashBalance',
      'createdAt',
      'latestBuyDate',
      'nextSimulationDate',
    ],
    rows.map((u) => [
      u.userId,
      u.password,
      u.displayName,
      u.cashBalance,
      u.createdAt,
      u.latestBuyDate,
      u.nextSimulationDate,
    ]),
  );
}

function readHoldings(userId: string): Holding[] {
  const path = resolve(userDir(userId), 'holdings.csv');
  if (!existsSync(path)) return [];
  const rows = parseCsv(readFileSync(path, 'utf8'));
  if (rows.length < 2) return [];
  return rows.slice(1).map((r) => ({
    symbol: r[0] ?? '',
    units: Number(r[1] ?? 0) || 0,
    averageCost: Number(r[2] ?? 0) || 0,
  })).filter((h) => h.symbol && h.units > 0);
}

function writeHoldings(userId: string, holdings: Holding[]): void {
  writeCsv(
    resolve(userDir(userId), 'holdings.csv'),
    ['symbol', 'units', 'averageCost'],
    holdings.map((h) => [h.symbol, h.units, h.averageCost]),
  );
}

function readOrders(userId: string): Order[] {
  const path = resolve(userDir(userId), 'orders.csv');
  if (!existsSync(path)) return [];
  const rows = parseCsv(readFileSync(path, 'utf8'));
  if (rows.length < 2) return [];
  return rows.slice(1).map((r) => ({
    id: r[0] ?? '',
    userId,
    symbol: r[1] ?? '',
    side: (r[2] as Order['side']) ?? 'BUY',
    units: Number(r[3] ?? 0) || 0,
    kind: (r[4] as Order['kind']) ?? 'PRE_SIMULATION',
    status: (r[5] as Order['status']) ?? 'PENDING',
    simulationCycle: r[6] ? Number(r[6]) : null,
    fillPrice: r[7] ? Number(r[7]) : null,
    placedAt: r[8] ?? '',
    filledAt: r[9] || null,
  })).filter((o) => o.id);
}

function writeOrders(userId: string, orders: Order[]): void {
  writeCsv(
    resolve(userDir(userId), 'orders.csv'),
    [
      'id',
      'symbol',
      'side',
      'units',
      'kind',
      'status',
      'simulationCycle',
      'fillPrice',
      'placedAt',
      'filledAt',
    ],
    orders.map((o) => [
      o.id,
      o.symbol,
      o.side,
      o.units,
      o.kind,
      o.status,
      o.simulationCycle,
      o.fillPrice,
      o.placedAt,
      o.filledAt,
    ]),
  );
}

function readLedger(userId: string): LedgerEntry[] {
  const path = resolve(userDir(userId), 'ledger.csv');
  if (!existsSync(path)) return [];
  const rows = parseCsv(readFileSync(path, 'utf8'));
  if (rows.length < 2) return [];
  return rows.slice(1).map((r) => ({
    id: r[0] ?? '',
    userId,
    symbol: r[1] ?? '',
    side: (r[2] as LedgerEntry['side']) ?? 'BUY',
    units: Number(r[3] ?? 0) || 0,
    price: Number(r[4] ?? 0) || 0,
    amount: Number(r[5] ?? 0) || 0,
    simulationCycle: r[6] ? Number(r[6]) : null,
    marketDate: r[7] || null,
    orderId: r[8] || null,
    createdAt: r[9] ?? '',
    note: r[10] || undefined,
  })).filter((e) => e.id);
}

function writeLedger(userId: string, ledger: LedgerEntry[]): void {
  writeCsv(
    resolve(userDir(userId), 'ledger.csv'),
    [
      'id',
      'symbol',
      'side',
      'units',
      'price',
      'amount',
      'simulationCycle',
      'marketDate',
      'orderId',
      'createdAt',
      'note',
    ],
    ledger.map((e) => [
      e.id,
      e.symbol,
      e.side,
      e.units,
      e.price,
      e.amount,
      e.simulationCycle,
      e.marketDate,
      e.orderId,
      e.createdAt,
      e.note ?? '',
    ]),
  );
}

function readGrowth(userId: string): PortfolioSnapshot[] {
  const path = resolve(userDir(userId), 'growth.csv');
  if (!existsSync(path)) return [];
  const rows = parseCsv(readFileSync(path, 'utf8'));
  if (rows.length < 2) return [];
  return rows.slice(1).map((r) => ({
    date: r[0] ?? '',
    totalValue: Number(r[1] ?? 0) || 0,
    cashBalance: Number(r[2] ?? 0) || 0,
    investedValue: Number(r[3] ?? 0) || 0,
  })).filter((g) => g.date);
}

function writeGrowth(userId: string, growth: PortfolioSnapshot[]): void {
  writeCsv(
    resolve(userDir(userId), 'growth.csv'),
    ['date', 'totalValue', 'cashBalance', 'investedValue'],
    growth.map((g) => [g.date, g.totalValue, g.cashBalance, g.investedValue]),
  );
}

export function loadUserAccount(userId: string): UserAccount | null {
  const row = readUserRows().find((u) => u.userId === userId);
  if (!row) return null;
  return {
    user: {
      id: row.userId,
      email: row.userId,
      displayName: row.displayName,
      cashBalance: row.cashBalance,
      createdAt: row.createdAt,
    },
    holdings: readHoldings(userId),
    orders: readOrders(userId),
    ledger: readLedger(userId),
    growthHistory: readGrowth(userId),
    latestBuyDate: row.latestBuyDate || null,
    nextSimulationDate: row.nextSimulationDate || EMPTY_PORTFOLIO_START_DATE,
    passwordHash: row.password,
  };
}

export function saveUserAccount(account: UserAccount): void {
  const rows = readUserRows();
  const next: UserRow = {
    userId: account.user.id,
    password: account.passwordHash,
    displayName: account.user.displayName,
    cashBalance: account.user.cashBalance,
    createdAt: account.user.createdAt,
    latestBuyDate: account.latestBuyDate ?? '',
    nextSimulationDate: account.nextSimulationDate,
  };
  const idx = rows.findIndex((r) => r.userId === account.user.id);
  if (idx >= 0) rows[idx] = next;
  else rows.push(next);
  writeUserRows(rows);
  ensureDir(userDir(account.user.id));
  writeHoldings(account.user.id, account.holdings);
  writeOrders(account.user.id, account.orders);
  writeLedger(account.user.id, account.ledger);
  writeGrowth(account.user.id, account.growthHistory);
}

export function createUserAccount(
  userId: string,
  password: string,
  displayName: string,
): UserAccount {
  const id = validateUsername(userId);
  if (readUserRows().some((u) => u.userId.toLowerCase() === id.toLowerCase())) {
    throw Object.assign(new Error('Username already taken'), { status: 409 });
  }
  if (!password || password.length < 4) {
    throw Object.assign(new Error('Password must be at least 4 characters'), { status: 400 });
  }
  const now = new Date().toISOString();
  const account: UserAccount = {
    user: {
      id,
      email: id,
      displayName: displayName.trim() || id,
      cashBalance: 0,
      createdAt: now,
    },
    holdings: [],
    orders: [],
    ledger: [],
    growthHistory: [
      {
        date: EMPTY_PORTFOLIO_START_DATE,
        totalValue: 0,
        cashBalance: 0,
        investedValue: 0,
      },
    ],
    latestBuyDate: null,
    nextSimulationDate: EMPTY_PORTFOLIO_START_DATE,
    passwordHash: password,
  };
  saveUserAccount(account);
  return structuredClone(account);
}

export function authenticateUser(userId: string, password: string): UserAccount {
  const id = userId.trim();
  const row = readUserRows().find((u) => u.userId.toLowerCase() === id.toLowerCase());
  if (!row || row.password !== password) {
    throw Object.assign(new Error('Invalid username or password'), { status: 401 });
  }
  const account = loadUserAccount(row.userId);
  if (!account) throw Object.assign(new Error('User account not found'), { status: 404 });
  return account;
}

export function listAllUserIds(): string[] {
  return readUserRows().map((u) => u.userId);
}

export function listAllAccounts(): UserAccount[] {
  return listAllUserIds()
    .map((id) => loadUserAccount(id))
    .filter((a): a is UserAccount => a != null);
}

export function resetUserAccount(userId: string): UserAccount {
  const existing = loadUserAccount(userId);
  if (!existing) throw Object.assign(new Error('User not found'), { status: 404 });
  const fresh: UserAccount = {
    user: {
      ...existing.user,
      cashBalance: 0,
    },
    holdings: [],
    orders: [],
    ledger: [],
    growthHistory: [
      {
        date: EMPTY_PORTFOLIO_START_DATE,
        totalValue: 0,
        cashBalance: 0,
        investedValue: 0,
      },
    ],
    latestBuyDate: null,
    nextSimulationDate: EMPTY_PORTFOLIO_START_DATE,
    passwordHash: existing.passwordHash,
  };
  saveUserAccount(fresh);
  return structuredClone(fresh);
}

export function resetAllUserAccounts(): number {
  const ids = listAllUserIds();
  for (const id of ids) resetUserAccount(id);
  return ids.length;
}

export function deleteUserDataDir(userId: string): void {
  const dir = userDir(userId);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

export function listUserDirs(): string[] {
  const root = resolve(localDbRoot(), 'users');
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export type { UserProfile };
