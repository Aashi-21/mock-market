/**
 * Generate a realistic intraday path from open → close using a Brownian bridge.
 * Path is pinned to open at t=0 and close at t=1, with bounded random variance.
 */
export function generateIntradayPath(
  open: number,
  close: number,
  steps: number,
  seed?: number,
): number[] {
  if (steps < 2) return [round(open), round(close)];

  const rng = mulberry32(seed ?? hashSeed(open, close, steps));
  const mid = (open + close) / 2;
  const vol = Math.max(mid * 0.004, Math.abs(close - open) * 0.35, 0.05);

  // Unconditioned random walk increments
  const increments: number[] = [];
  let raw = open;
  const rawPath: number[] = [open];
  for (let i = 1; i < steps; i += 1) {
    const shock = (rng() * 2 - 1) * vol;
    // Mild mean reversion toward the eventual close trajectory
    const progress = i / (steps - 1);
    const target = open + (close - open) * progress;
    const pull = (target - raw) * 0.08;
    const next = raw + shock + pull;
    increments.push(next - raw);
    raw = next;
    rawPath.push(raw);
  }

  // Brownian bridge: force endpoint to `close`
  const drift = close - rawPath[rawPath.length - 1];
  const path: number[] = new Array(steps);
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    path[i] = round(Math.max(0.05, rawPath[i] + drift * t));
  }
  path[0] = round(open);
  path[steps - 1] = round(close);
  return path;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function hashSeed(a: number, b: number, c: number): number {
  return Math.floor((a * 1000 + b * 100 + c) * 997) >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
