import { Navigate, useNavigate } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';
import { PortfolioGrowth } from '../components/portfolio/PortfolioGrowth';
import { HoldingsTable } from '../components/portfolio/HoldingsTable';
import { OrderForm } from '../components/orders/OrderForm';
import { PendingOrders } from '../components/orders/PendingOrders';
import { MarketTable } from '../components/market/MarketTable';
import { formatDate } from '../utils/format';

export function SimulationPage() {
  const {
    portfolio,
    orders,
    marketDate,
    simulationStocks,
    phase,
    session,
    loading,
    placeOrder,
    cancelOrder,
    endSimulation,
    continueSimulation,
  } = useAppData();
  const navigate = useNavigate();

  if (phase !== 'TRADING' && phase !== 'ANALYSIS') {
    return <Navigate to="/dashboard" replace />;
  }

  if (!portfolio || !session) {
    return <p className="page-loading">Preparing simulation…</p>;
  }

  async function handleStop() {
    await endSimulation();
    navigate('/dashboard');
  }

  const progressPct =
    session.tickCount > 1
      ? Math.round((session.tickIndex / (session.tickCount - 1)) * 100)
      : 0;

  const analysisRemainingMs = session.analysisEndsAt
    ? Math.max(0, Date.parse(session.analysisEndsAt) - Date.now())
    : 0;

  return (
    <div className="page simulation-page">
      <header className="page-hero">
        <div>
          <p className="eyebrow">
            {phase === 'ANALYSIS' ? 'Analysis window' : 'Live simulation'} · Day{' '}
            {session.cycle}/{session.maxCycles}
          </p>
          <h1 className="page-title">
            {phase === 'ANALYSIS' ? 'Review the close' : 'Trade the mock tape'}
          </h1>
          <p className="page-lede">
            Market date <strong>{marketDate ? formatDate(marketDate) : '—'}</strong>.
            {phase === 'TRADING'
              ? ' Prices refresh from open toward close; trades fill at the live quote.'
              : ' Day complete — continue to the next session day or end the simulation.'}
          </p>
        </div>
        <div className="hero-actions">
          {phase === 'ANALYSIS' && session.cycle < session.maxCycles && (
            <button
              type="button"
              className="btn btn--accent"
              disabled={loading}
              onClick={() => void continueSimulation()}
            >
              Continue next day
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            disabled={loading}
            onClick={() => void handleStop()}
          >
            End simulation
          </button>
        </div>
      </header>

      <div className="sim-status-bar">
        {phase === 'TRADING' ? (
          <>
            <span>
              Intraday progress <strong className="mono">{progressPct}%</strong>
            </span>
            <div className="progress-track" aria-hidden>
              <div className="progress-track__fill" style={{ width: `${progressPct}%` }} />
            </div>
          </>
        ) : (
          <span>
            Analysis time left{' '}
            <strong className="mono">{Math.ceil(analysisRemainingMs / 1000)}s</strong>
            {session.cycle >= session.maxCycles ? ' · max days reached' : ''}
          </span>
        )}
      </div>

      <div className="simulation-grid">
        <MarketTable stocks={simulationStocks} holdings={portfolio.holdings} />
        {phase === 'TRADING' && (
          <OrderForm
            holdings={portfolio.holdings}
            cashBalance={portfolio.cashBalance}
            availableStocks={simulationStocks}
            isPreSimulation={false}
            onSubmit={placeOrder}
          />
        )}
        <PortfolioGrowth portfolio={portfolio} />
        <HoldingsTable holdings={portfolio.holdings} quotes={simulationStocks} />
        <PendingOrders orders={orders} onCancel={cancelOrder} />
      </div>

      {loading && <p className="muted inline-status">Updating…</p>}
    </div>
  );
}
