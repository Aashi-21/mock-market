import type { Holding, Stock } from '../types';
import { getStockBySymbol, NIFTY50_POOL } from '../data/mockMarket';

export function nonZeroHoldings(holdings: Holding[]): Holding[] {
  return holdings.filter((h) => h.units > 0);
}

export function portfolioMarketValue(
  holdings: Holding[],
  priceLookup: (symbol: string) => number,
): number {
  return holdings.reduce(
    (sum, h) => sum + holdingMarketValue(h, priceLookup(h.symbol)),
    0,
  );
}

export function holdingMarketValue(holding: Holding, lastPrice: number): number {
  return holding.units * lastPrice;
}

export function canAddHolding(_holdings: Holding[], _symbol: string): boolean {
  return true;
}

/**
 * Build the simulation board from the live quote list (full catalog when admin runs).
 * Fallback for mocks: entire NIFTY pool.
 */
export function buildSimulationUniverse(holdings: Holding[]): Stock[] {
  const requiredSymbols = nonZeroHoldings(holdings).map((h) => h.symbol);
  const selected = new Map<string, Stock>();

  for (const symbol of requiredSymbols) {
    const stock = getStockBySymbol(symbol);
    if (stock) selected.set(symbol, stock);
  }
  for (const stock of NIFTY50_POOL) {
    if (!selected.has(stock.symbol)) selected.set(stock.symbol, stock);
  }
  return Array.from(selected.values());
}

export function unitsHeld(holdings: Holding[], symbol: string): number {
  return holdings.find((h) => h.symbol === symbol)?.units ?? 0;
}
