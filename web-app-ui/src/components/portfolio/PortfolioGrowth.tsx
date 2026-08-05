import type { Portfolio } from '../../types';
import { formatINR, formatPct } from '../../utils/format';

interface Props {
  portfolio: Portfolio;
}

export function PortfolioGrowth({ portfolio }: Props) {
  const history = portfolio.growthHistory;
  if (history.length === 0) return null;

  const latest = history[history.length - 1];
  const earliest = history[0];
  const growthPct =
    earliest.totalValue === 0
      ? 0
      : ((latest.totalValue - earliest.totalValue) / earliest.totalValue) * 100;

  const max = Math.max(...history.map((h) => h.totalValue));
  const min = Math.min(...history.map((h) => h.totalValue));
  const range = Math.max(max - min, 1);
  const pad = 8;

  const points = history
    .map((point, index) => {
      const x = (index / Math.max(history.length - 1, 1)) * 100;
      const rawY = ((point.totalValue - min) / range) * (100 - pad * 2);
      const y = 100 - pad - rawY;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `0,100 ${points} 100,100`;

  return (
    <section className="panel growth-panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">Portfolio growth</h2>
          <p className="panel__subtitle">Value through the latest available market date</p>
        </div>
        <div className="growth-stats">
          <div>
            <span className="stat-label">Total value</span>
            <strong className="stat-value">{formatINR(latest.totalValue)}</strong>
          </div>
          <div>
            <span className="stat-label">Period change</span>
            <strong className={`stat-value ${growthPct >= 0 ? 'is-up' : 'is-down'}`}>
              {formatPct(growthPct)}
            </strong>
          </div>
        </div>
      </div>

      <div className="growth-chart" aria-hidden>
        <div className="growth-chart__plot">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="growth-chart__svg"
            width="100%"
            height="100%"
          >
            <defs>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <polygon points={areaPoints} fill="url(#growthFill)" className="growth-chart__area" />
            <polyline
              points={points}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              className="growth-chart__line"
            />
          </svg>
        </div>
        <div className="growth-chart__axis">
          <span>{formatINR(earliest.totalValue)}</span>
          <span>{formatINR(latest.totalValue)}</span>
        </div>
      </div>

      <div className="growth-breakdown">
        <div>
          <span className="stat-label">Cash</span>
          <span>{formatINR(portfolio.cashBalance)}</span>
        </div>
        <div>
          <span className="stat-label">Invested</span>
          <span>{formatINR(latest.investedValue)}</span>
        </div>
      </div>
    </section>
  );
}
