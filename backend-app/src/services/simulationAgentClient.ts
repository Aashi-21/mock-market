/**
 * Client for the Python simulation-agent service.
 * Replaces the former in-process Brownian-bridge path generator.
 */

import { config } from '../config.js';

export interface DayBarInput {
  previous_close: number;
  open: number;
  high: number;
  low: number;
  last?: number;
  close: number;
  vwap: number;
  volume?: number;
  turnover?: number;
  trades?: number;
  deliverable_volume?: number;
  deliverable_pct?: number;
}

export interface SimulateDayResult {
  session_id: string | null;
  stock_id: string;
  date: string;
  seed: number;
  minutes: number;
  closes: number[];
  realized_vwap: number;
  target_vwap: number;
}

interface SimulateDayResponseBody {
  session_id: string | null;
  stock_id: string;
  date: string;
  seed: number;
  minutes: number;
  closes: number[];
  realized_vwap: number;
  target_vwap: number;
}

export async function fetchIntradayPath(params: {
  stockId: string;
  date: string;
  dayBar: DayBarInput;
  seed?: number;
}): Promise<SimulateDayResult> {
  const url = `${config.simulationAgentUrl.replace(/\/$/, '')}/v1/simulate/day`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.simulationAgentApiKey) {
    headers['X-API-Key'] = config.simulationAgentApiKey;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      stock_id: params.stockId,
      date: params.date,
      seed: params.seed ?? undefined,
      day_bar: {
        previous_close: params.dayBar.previous_close,
        open: params.dayBar.open,
        high: params.dayBar.high,
        low: params.dayBar.low,
        last: params.dayBar.last ?? params.dayBar.close,
        close: params.dayBar.close,
        vwap: params.dayBar.vwap,
        volume: params.dayBar.volume,
        turnover: params.dayBar.turnover,
        trades: params.dayBar.trades,
        deliverable_volume: params.dayBar.deliverable_volume,
        deliverable_pct: params.dayBar.deliverable_pct,
      },
      persist_session: true,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw Object.assign(
      new Error(`simulation-agent error ${res.status}: ${detail}`),
      { status: 502 },
    );
  }

  const body = (await res.json()) as SimulateDayResponseBody;
  if (!Array.isArray(body.closes) || body.closes.length < 2) {
    throw Object.assign(new Error('simulation-agent returned empty path'), { status: 502 });
  }

  return {
    session_id: body.session_id,
    stock_id: body.stock_id,
    date: body.date,
    seed: body.seed,
    minutes: body.minutes,
    closes: body.closes,
    realized_vwap: body.realized_vwap,
    target_vwap: body.target_vwap,
  };
}

/** Downsample or stretch a 375-minute path onto the session tick grid. */
export function resampleCloses(closes: number[], tickCount: number): number[] {
  if (tickCount <= 1) return [closes[0] ?? 0];
  if (closes.length === tickCount) return closes.slice();
  const out = new Array<number>(tickCount);
  for (let i = 0; i < tickCount; i += 1) {
    const t = i / (tickCount - 1);
    const src = t * (closes.length - 1);
    const lo = Math.floor(src);
    const hi = Math.min(closes.length - 1, lo + 1);
    const w = src - lo;
    out[i] = closes[lo]! * (1 - w) + closes[hi]! * w;
  }
  out[0] = closes[0]!;
  out[tickCount - 1] = closes[closes.length - 1]!;
  return out.map((n) => Math.round(n * 100) / 100);
}

export interface CandleBar {
  minute_index: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchCandles(params: {
  stockId: string;
  date: string;
  dayBar: DayBarInput;
  seed?: number;
  upToMinute?: number;
}): Promise<{ candles: CandleBar[]; session_id: string | null }> {
  const url = `${config.simulationAgentUrl.replace(/\/$/, '')}/v1/candles`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.simulationAgentApiKey) headers['X-API-Key'] = config.simulationAgentApiKey;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      stock_id: params.stockId,
      date: params.date,
      seed: params.seed ?? undefined,
      up_to_minute: params.upToMinute ?? undefined,
      day_bar: {
        previous_close: params.dayBar.previous_close,
        open: params.dayBar.open,
        high: params.dayBar.high,
        low: params.dayBar.low,
        last: params.dayBar.last ?? params.dayBar.close,
        close: params.dayBar.close,
        vwap: params.dayBar.vwap,
        volume: params.dayBar.volume,
        turnover: params.dayBar.turnover,
        trades: params.dayBar.trades,
        deliverable_volume: params.dayBar.deliverable_volume,
        deliverable_pct: params.dayBar.deliverable_pct,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw Object.assign(new Error(`simulation-agent candles error ${res.status}: ${detail}`), {
      status: 502,
    });
  }

  const body = (await res.json()) as {
    session_id: string | null;
    candles: CandleBar[];
  };
  return { candles: body.candles ?? [], session_id: body.session_id };
}
