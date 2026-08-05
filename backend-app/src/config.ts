import 'dotenv/config';

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num('PORT', 8080),
  apiPrefix: process.env.API_PREFIX ?? '/api',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  backendApiKey: process.env.BACKEND_API_KEY ?? '',
  stockDataApiKey: process.env.STOCK_DATA_API_KEY ?? '',
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? 'mock-market-local',
    authEmulator: (process.env.FIREBASE_AUTH_EMULATOR ?? 'true') === 'true',
    dbUrl: process.env.FIREBASE_DB_URL ?? 'https://mock-market-local.firebaseio.com',
  },
  /** Divides wall-clock intervals. 1 = real 31m15s days. */
  simulationTimeScale: Math.max(1, num('SIMULATION_TIME_SCALE', 1)),
  longPollMaxMs: num('LONG_POLL_MAX_MS', 25_000),
} as const;
