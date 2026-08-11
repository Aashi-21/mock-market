import { useMemo, useState, type FormEvent } from 'react';
import type { OrderSide, Stock } from '../../types';
import { NIFTY50_POOL } from '../../data/mockMarket';
import { formatINR } from '../../utils/format';
import { unitsHeld } from '../../utils/portfolio';
import type { Holding } from '../../types';

interface Props {
  holdings: Holding[];
  cashBalance: number;
  /** When provided, restricts the symbol picker to this list (simulation board). */
  availableStocks?: Stock[];
  isPreSimulation: boolean;
  onSubmit: (input: {
    symbol: string;
    side: OrderSide;
    units: number;
    isPreSimulation: boolean;
  }) => Promise<void>;
}

export function OrderForm({
  holdings,
  cashBalance,
  availableStocks,
  isPreSimulation,
  onSubmit,
}: Props) {
  const stocks = availableStocks ?? NIFTY50_POOL;
  const [symbol, setSymbol] = useState(stocks[0]?.symbol ?? '');
  const [side, setSide] = useState<OrderSide>('BUY');
  const [units, setUnits] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const selected = useMemo(
    () => stocks.find((s) => s.symbol === symbol),
    [stocks, symbol],
  );

  const held = unitsHeld(holdings, symbol);
  const estimated = selected && selected.lastPrice > 0 ? selected.lastPrice * units : 0;


  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);

    if (!symbol || units < 1) {
      setLocalError('Choose a symbol and enter at least 1 unit.');
      return;
    }

    if (side === 'BUY' && estimated > cashBalance) {
      setLocalError('Insufficient cash for this buy.');
      return;
    }

    if (side === 'SELL' && units > held) {
      setLocalError(`You only hold ${held} units of ${symbol}.`);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ symbol, side, units, isPreSimulation });
      setUnits(1);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel order-panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">
            {isPreSimulation ? 'Pre-simulation order' : 'Place order'}
          </h2>
          <p className="panel__subtitle">
            {isPreSimulation
              ? 'Queued orders fill when you begin the simulation'
              : 'Orders execute immediately against last traded price'}
          </p>
        </div>
      </div>

      <form className="order-form" onSubmit={(e) => void handleSubmit(e)}>
        <label className="field">
          <span>Side</span>
          <div className="segmented" role="group" aria-label="Order side">
            <button
              type="button"
              className={`segmented__btn ${side === 'BUY' ? 'is-active is-buy' : ''}`}
              onClick={() => setSide('BUY')}
            >
              Buy
            </button>
            <button
              type="button"
              className={`segmented__btn ${side === 'SELL' ? 'is-active is-sell' : ''}`}
              onClick={() => setSide('SELL')}
            >
              Sell
            </button>
          </div>
        </label>

        <label className="field">
          <span>Symbol</span>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {stocks.map((stock) => (
              <option key={stock.symbol} value={stock.symbol}>
                {stock.symbol} — {stock.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Units</span>
          <input
            type="number"
            min={1}
            step={1}
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
          />
        </label>

        <div className="order-meta">
          <div>
            <span className="stat-label">LTP</span>
            <span className="mono">{selected ? formatINR(selected.lastPrice) : '—'}</span>
          </div>
          <div>
            <span className="stat-label">Held</span>
            <span className="mono">{held}</span>
          </div>
          <div>
            <span className="stat-label">Est. value</span>
            <span className="mono">{formatINR(estimated)}</span>
          </div>
          <div>
            <span className="stat-label">Cash</span>
            <span className="mono">{formatINR(cashBalance)}</span>
          </div>
        </div>

        {localError && <p className="form-error">{localError}</p>}

        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting
            ? 'Submitting…'
            : isPreSimulation
              ? `Queue ${side.toLowerCase()} order`
              : `Submit ${side.toLowerCase()} order`}
        </button>
      </form>
    </section>
  );
}
