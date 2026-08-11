import type { Holding, Stock } from '../../types';
import { getStockBySymbol } from '../../data/mockMarket';
import { formatINR, formatPct } from '../../utils/format';
import { nonZeroHoldings } from '../../utils/portfolio';

interface Props {
  holdings: Holding[];
  /** Prefer live/session quotes when provided. */
  quotes?: Stock[];
}

export function HoldingsTable({ holdings, quotes }: Props) {
  const active = nonZeroHoldings(holdings);

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">Holdings</h2>
          <p className="panel__subtitle">
            {active.length} holdings · NSE catalog
          </p>
        </div>
      </div>

      {active.length === 0 ? (
        <p className="empty-state">No open positions. Place a buy order to start building the book.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Company</th>
                <th className="num">Units</th>
                <th className="num">Avg cost</th>
                <th className="num">LTP</th>
                <th className="num">Value</th>
                <th className="num">P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {active.map((holding) => {
                const live = quotes?.find((q) => q.symbol === holding.symbol);
                const stock = getStockBySymbol(holding.symbol);
                const ltp = live?.lastPrice ?? stock?.lastPrice ?? holding.averageCost;
                const value = holding.units * ltp;
                const cost = holding.units * holding.averageCost;
                const pnlPct = cost === 0 ? 0 : ((value - cost) / cost) * 100;

                return (
                  <tr key={holding.symbol}>
                    <td>
                      <span className="symbol-chip">{holding.symbol}</span>
                    </td>
                    <td>{live?.name ?? stock?.name ?? holding.symbol}</td>
                    <td className="num mono">{holding.units}</td>
                    <td className="num mono">{formatINR(holding.averageCost)}</td>
                    <td className="num mono">{formatINR(ltp)}</td>
                    <td className="num mono">{formatINR(value)}</td>
                    <td className={`num mono ${pnlPct >= 0 ? 'is-up' : 'is-down'}`}>
                      {formatPct(pnlPct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
