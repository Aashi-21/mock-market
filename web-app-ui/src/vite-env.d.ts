/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_BACKEND_API_KEY: string;
  readonly VITE_STOCK_DATA_API_KEY: string;
  readonly VITE_USE_MOCKS: string;
  readonly VITE_LONG_POLL_WAIT_MS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
