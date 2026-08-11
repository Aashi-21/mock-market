import {
  type Holding,
  type LedgerEntry,
  type Order,
  type OrderSide,
  type UserAccount,
} from '../types/index.js';
import { createId, roundMoney, roundPrice } from '../utils/helpers.js';
import { markSnapshot, upsertOrder } from '../store/memoryStore.js';

export function nonZeroHoldings(holdings: Holding[]): Holding[] {
  return holdings.filter((h) => h.units > 0);
}

export function unitsHeld(holdings: Holding[], symbol: string): number {
  return holdings.find((h) => h.symbol === symbol)?.units ?? 0;
}

export function canAddHolding(_holdings: Holding[], _symbol: string): boolean {
  return true;
}

export function applyFill(
  account: UserAccount,
  order: Order,
  price: number,
  marketDate: string | null,
  note?: string,
): LedgerEntry {
  const px = roundPrice(price);
  if (order.side === 'BUY') {
    const cost = roundMoney(px * order.units);
    if (cost > account.user.cashBalance) {
      throw Object.assign(new Error('Insufficient cash balance'), { status: 400 });
    }
    account.user.cashBalance = roundMoney(account.user.cashBalance - cost);
    upsertHolding(account.holdings, order.symbol, order.units, px);
    if (marketDate) account.latestBuyDate = marketDate;
  } else {
    const held = unitsHeld(account.holdings, order.symbol);
    if (order.units > held) {
      throw Object.assign(new Error(`Cannot sell ${order.units}; hold ${held}`), { status: 400 });
    }
    account.user.cashBalance = roundMoney(account.user.cashBalance + px * order.units);
    reduceHolding(account.holdings, order.symbol, order.units);
  }

  order.status = 'FILLED';
  order.fillPrice = px;
  order.filledAt = new Date().toISOString();
  upsertOrder(account, order);

  const entry: LedgerEntry = {
    id: createId('led'),
    userId: account.user.id,
    symbol: order.symbol,
    side: order.side,
    units: order.units,
    price: px,
    amount: roundMoney(px * order.units),
    simulationCycle: order.simulationCycle,
    marketDate,
    orderId: order.id,
    createdAt: new Date().toISOString(),
    note,
  };
  account.ledger.unshift(entry);
  if (marketDate) markSnapshot(account, marketDate);
  return entry;
}

function upsertHolding(holdings: Holding[], symbol: string, units: number, price: number): void {
  const existing = holdings.find((h) => h.symbol === symbol);
  if (!existing) {
    holdings.push({ symbol, units, averageCost: price });
    return;
  }
  const totalCost = existing.averageCost * existing.units + price * units;
  const totalUnits = existing.units + units;
  existing.units = totalUnits;
  existing.averageCost = roundPrice(totalCost / totalUnits);
}

function reduceHolding(holdings: Holding[], symbol: string, units: number): void {
  const existing = holdings.find((h) => h.symbol === symbol);
  if (!existing) return;
  existing.units -= units;
  if (existing.units <= 0) {
    const idx = holdings.findIndex((h) => h.symbol === symbol);
    if (idx >= 0) holdings.splice(idx, 1);
  }
}

export function validateOrderIntent(
  account: UserAccount,
  side: OrderSide,
  symbol: string,
  units: number,
  priceHint?: number,
): void {
  if (!Number.isInteger(units) || units <= 0) {
    throw Object.assign(new Error('Units must be a positive whole number'), { status: 400 });
  }
  if (side === 'BUY') {
    if (priceHint != null) {
      const cost = priceHint * units;
      if (cost > account.user.cashBalance) {
        throw Object.assign(new Error('Insufficient cash balance'), { status: 400 });
      }
    }
  } else if (units > unitsHeld(account.holdings, symbol)) {
    throw Object.assign(
      new Error(`Cannot sell ${units}; hold ${unitsHeld(account.holdings, symbol)}`),
      { status: 400 },
    );
  }
}
