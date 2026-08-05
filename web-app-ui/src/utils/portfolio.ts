import type { Holding, Stock } from '../types';
import { MAX_PORTFOLIO_HOLDINGS, SIMULATION_MARKET_SIZE } from '../types';
import { NIFTY50_POOL, getStockBySymbol } from '../data/mockMarket';

export function holdingMarketValue(holding: Holding, price: number): number {
  return holding.units * price;
}

export function portfolioInvestedValue(
  holdings: Holding[],
  priceLookup: (symbol: string) => number,
): number {
  return holdings.reduce(
    (sum, h) => sum + holdingMarketValue(h, priceLookup(h.symbol)),
    0,
  );
}

export function nonZeroHoldings(holdings: Holding[]): Holding[] {
  return holdings.filter((h) => h.units > 0);
}

export function canAddHolding(holdings: Holding[], symbol: string): boolean {
  const active = nonZeroHoldings(holdings);
  if (active.some((h) => h.symbol === symbol)) return true;
  return active.length < MAX_PORTFOLIO_HOLDINGS;
}

/**
 * Build the 10-stock simulation board.
 * Always includes every non-zero portfolio holding, then fills from the Nifty pool.
 */
export function buildSimulationUniverse(holdings: Holding[]): Stock[] {
  const requiredSymbols = nonZeroHoldings(holdings).map((h) => h.symbol);
  const selected = new Map<string, Stock>();

  for (const symbol of requiredSymbols) {
    const stock = getStockBySymbol(symbol);
    if (stock) selected.set(symbol, stock);
  }

  for (const stock of NIFTY50_POOL) {
    if (selected.size >= SIMULATION_MARKET_SIZE) break;
    if (!selected.has(stock.symbol)) selected.set(stock.symbol, stock);
  }

  return Array.from(selected.values()).slice(0, SIMULATION_MARKET_SIZE);
}

export function unitsHeld(holdings: Holding[], symbol: string): number {
  return holdings.find((h) => h.symbol === symbol)?.units ?? 0;
}
