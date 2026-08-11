import { useMemo } from 'react';
import type { CandleBar } from '../../services/marketApi';
import { formatINR } from '../../utils/format';

interface Props {
  symbol: string;
  name?: string;
  date: string;
  candles: CandleBar[];
  loading?: boolean;
  /** Highlight progress through the day (tick index). */
  progressIndex?: number;
}

export function CandleChart({
  symbol,
  name,
  date,
  candles,
  loading,
  progressIndex,
}: Props) {
  const width = 720;
  const height = 280;
  const pad = { top: 16, right: 16, bottom: 28, left: 56 };

  const geometry = useMemo(() => {
    if (candles.length === 0) return null;
    const slice =
      progressIndex != null && progressIndex >= 0
        ? candles.slice(0, Math.min(candles.length, progressIndex + 1))
        : candles;
    if (slice.length === 0) return null;

    const highs = slice.map((c) => c.high);
    const lows = slice.map((c) => c.low);
    const minP = Math.min(...lows);
    const maxP = Math.max(...highs);
    const span = Math.max(maxP - minP, minP * 0.002, 0.05);
    const yMin = minP - span * 0.08;
    const yMax = maxP + span * 0.08;
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const slot = innerW / slice.length;
    const bodyW = Math.max(1.5, Math.min(6, slot * 0.65));

    const yScale = (p: number) => pad.top + ((yMax - p) / (yMax - yMin)) * innerH;
    const xScale = (i: number) => pad.left + i * slot + slot / 2;

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + (yMax - yMin) * t);

    return { slice, yMin, yMax, yScale, xScale, bodyW, ticks, innerW, innerH };
  }, [candles, progressIndex]);

  return (
    <section className="panel candle-panel">
      <div className="panel__head">
        <div>
          <h2 className="panel__title">
            {symbol}
            {name ? <span className="muted candle-name"> · {name}</span> : null}
          </h2>
          <p className="panel__subtitle">
            Minute candles · {date}
            {loading ? ' · loading…' : ` · ${geometry?.slice.length ?? 0} bars`}
          </p>
        </div>
      </div>

      {!geometry ? (
        <p className="muted candle-empty">
          {loading ? 'Fetching path from simulation-agent…' : 'Select a stock to view candles.'}
        </p>
      ) : (
        <div className="candle-chart-wrap">
          <svg
            className="candle-chart"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${symbol} candlestick chart for ${date}`}
          >
            {geometry.ticks.map((price) => {
              const y = geometry.yScale(price);
              return (
                <g key={price}>
                  <line
                    x1={pad.left}
                    x2={width - pad.right}
                    y1={y}
                    y2={y}
                    className="candle-grid"
                  />
                  <text x={pad.left - 8} y={y + 3} textAnchor="end" className="candle-axis">
                    {formatINR(price)}
                  </text>
                </g>
              );
            })}

            {geometry.slice.map((c, i) => {
              const x = geometry.xScale(i);
              const yO = geometry.yScale(c.open);
              const yC = geometry.yScale(c.close);
              const yH = geometry.yScale(c.high);
              const yL = geometry.yScale(c.low);
              const up = c.close >= c.open;
              const bodyTop = Math.min(yO, yC);
              const bodyH = Math.max(1.5, Math.abs(yC - yO));
              return (
                <g key={c.minute_index} className={up ? 'candle is-up' : 'candle is-down'}>
                  <line x1={x} x2={x} y1={yH} y2={yL} className="candle-wick" />
                  <rect
                    x={x - geometry.bodyW / 2}
                    y={bodyTop}
                    width={geometry.bodyW}
                    height={bodyH}
                    className="candle-body"
                  />
                </g>
              );
            })}

            <text
              x={pad.left}
              y={height - 8}
              className="candle-axis"
            >
              {geometry.slice[0]?.time}
            </text>
            <text
              x={width - pad.right}
              y={height - 8}
              textAnchor="end"
              className="candle-axis"
            >
              {geometry.slice[geometry.slice.length - 1]?.time}
            </text>
          </svg>
        </div>
      )}
    </section>
  );
}
