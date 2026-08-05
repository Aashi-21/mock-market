/**
 * Central place for env-backed configuration.
 */
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api',
  backendApiKey: import.meta.env.VITE_BACKEND_API_KEY ?? '',
  stockDataApiKey: import.meta.env.VITE_STOCK_DATA_API_KEY ?? '',
  /** When false, all data goes through backend-app. */
  useMocks: (import.meta.env.VITE_USE_MOCKS ?? 'false') === 'true',
  longPollWaitMs: Number(import.meta.env.VITE_LONG_POLL_WAIT_MS ?? 20_000),
} as const;
