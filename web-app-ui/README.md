# Mock Market UI

React + TypeScript frontend for the Mock Market historical NSE simulation.

## Stack

- React 18 + TypeScript
- Vite 5
- PNPM
- React Router

## Commands

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build
pnpm lint
pnpm preview
```

Requires `backend-app` running on `http://localhost:8080`.

## Environment

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_BACKEND_API_KEY=
VITE_STOCK_DATA_API_KEY=
VITE_USE_MOCKS=false
VITE_LONG_POLL_WAIT_MS=20000
```

## Mock login

- Email: `trader@mockmarket.in`
- Password: `demo1234`

## Docs

See [`../wiki`](../wiki) — especially [backend app](../wiki/08-backend-app.md).
