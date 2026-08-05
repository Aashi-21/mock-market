import type { Holding, Stock } from '../../types';
import { formatINR, formatPct } from '../../utils/format';
import { unitsHeld } from '../../utils/portfolio';

interface Props {
  stocks: Stock[];
  holdings: Holding[];
  onSelectSymbol?: (symbol: string) => void;
}

export function MarketTable({ stocks, holdings }: Props) {
  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">Simulation board</h2>
          <p className="panel__subtitle">
            10 NSE names · portfolio holdings are always included
          </p>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Company</th>
              <th>Sector</th>
              <th className="num">LTP</th>
              <th className="num">Day %</th>
              <th className="num">Your units</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => {
              const held = unitsHeld(holdings, stock.symbol);
              return (
                <tr key={stock.symbol} className={held > 0 ? 'is-held' : undefined}>
                  <td>
                    <span className="symbol-chip">{stock.symbol}</span>
                  </td>
                  <td>{stock.name}</td>
                  <td className="muted">{stock.sector}</td>
                  <td className="num mono">{formatINR(stock.lastPrice)}</td>
                  <td
                    className={`num mono ${stock.dayChangePct >= 0 ? 'is-up' : 'is-down'}`}
                  >
                    {formatPct(stock.dayChangePct)}
                  </td>
                  <td className="num mono">{held}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
