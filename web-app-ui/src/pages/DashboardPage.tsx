import { Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAppData } from '../context/AppDataContext';
import { PortfolioGrowth } from '../components/portfolio/PortfolioGrowth';
import { HoldingsTable } from '../components/portfolio/HoldingsTable';
import { OrderForm } from '../components/orders/OrderForm';
import { PendingOrders } from '../components/orders/PendingOrders';
import { formatDate, formatINR } from '../utils/format';

export function DashboardPage() {
  const {
    portfolio,
    orders,
    marketDate,
    nextSimulationDate,
    loading,
    placeOrder,
    cancelOrder,
    phase,
    resetAccount,
    deposit,
    ledger,
    catalogStocks,
    session,
  } = useAppData();
  const navigate = useNavigate();
  const [depositAmount, setDepositAmount] = useState(50_000);

  useEffect(() => {
    if (phase === 'TRADING' || phase === 'ANALYSIS') {
      navigate('/simulation', { replace: true });
    }
  }, [phase, navigate]);

  const orderUniverse = catalogStocks.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    exchange: 'NSE' as const,
    sector: s.industry,
    lastPrice: 0,
    previousClose: 0,
    dayChangePct: 0,
    series: s.series,
  }));

  if (phase === 'TRADING' || phase === 'ANALYSIS') {
    return <Navigate to="/simulation" replace />;
  }

  if (loading && !portfolio) {
    return <p className="page-loading">Loading dashboard…</p>;
  }

  if (!portfolio) {
    return <p className="empty-state">Unable to load portfolio.</p>;
  }

  return (
    <div className="page dashboard-page">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="page-title">Your book at the open</h1>
          <p className="page-lede">
            Waiting for the admin to open the market
            {session ? ` (last status ${session.status})` : ''}. Queue pre-simulation
            orders against any listed NSE name. Next candidate date:{' '}
            <strong>
              {formatDate(nextSimulationDate ?? marketDate ?? '2008-01-01')}
            </strong>
            .
          </p>
        </div>
        <span className="muted">Trader cannot begin/end the simulation</span>
      </header>

      <div className="dashboard-actions">
        <form
          className="wallet-form"
          onSubmit={(e) => {
            e.preventDefault();
            void deposit(depositAmount);
          }}
        >
          <label className="field">
            <span>Add cash</span>
            <input
              type="number"
              min={1}
              step={1000}
              value={depositAmount}
              onChange={(e) => setDepositAmount(Number(e.target.value))}
            />
          </label>
          <button type="submit" className="btn btn--accent" disabled={loading}>
            Deposit {formatINR(depositAmount)}
          </button>
        </form>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={loading}
          onClick={() => {
            if (window.confirm('Reset your local account to ₹0?')) {
              void resetAccount();
            }
          }}
        >
          Reset account
        </button>
      </div>

      <div className="dashboard-grid">
        <PortfolioGrowth portfolio={portfolio} />
        <OrderForm
          holdings={portfolio.holdings}
          cashBalance={portfolio.cashBalance}
          availableStocks={orderUniverse.length > 0 ? orderUniverse : undefined}
          isPreSimulation
          onSubmit={placeOrder}
        />
        <HoldingsTable holdings={portfolio.holdings} />
        <PendingOrders orders={orders} onCancel={cancelOrder} />
      </div>

      {ledger.length > 0 && (
        <section className="panel ledger-panel">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Ledger</h2>
              <p className="panel__subtitle">Persisted fills from completed activity</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Side</th>
                  <th>Symbol</th>
                  <th className="num">Units</th>
                  <th className="num">Price</th>
                  <th>Market date</th>
                  <th>Cycle</th>
                </tr>
              </thead>
              <tbody>
                {ledger.slice(0, 12).map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <span className={`side-tag side-tag--${entry.side.toLowerCase()}`}>
                        {entry.side}
                      </span>
                    </td>
                    <td>
                      <span className="symbol-chip">{entry.symbol}</span>
                    </td>
                    <td className="num mono">{entry.units}</td>
                    <td className="num mono">{formatINR(entry.price)}</td>
                    <td>{entry.marketDate ? formatDate(entry.marketDate) : '—'}</td>
                    <td className="mono">{entry.simulationCycle ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
