# Local development

## Prerequisites

- Node.js 20+
- PNPM 9+ (`npm install -g pnpm@9` if needed)

## Backend

```bash
cd backend-app
cp .env.example .env
pnpm install
pnpm dev
```

API: [http://localhost:8080/api](http://localhost:8080/api)

Useful env:

| Variable | Meaning |
| --- | --- |
| `SIMULATION_TIME_SCALE` | Divides day/tick/analysis durations (`60` ≈ 31s/day) |
| `STOCK_DATA_API_KEY` | Reserved for future OHLC provider |
| `FIREBASE_*` | Reserved for Auth/RTDB |

## Frontend

```bash
cd web-app-ui
cp .env.example .env
pnpm install
pnpm dev
```

UI: [http://localhost:5173](http://localhost:5173)

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_USE_MOCKS=false
```

## Mock login

- Email: `trader@mockmarket.in`
- Password: `demo1234`

## Suggested flow

1. Start `backend-app`
2. Start `web-app-ui`
3. Sign in → deposit/reset as needed → queue pre-orders → begin simulation
4. Watch quotes update via long-poll → trade → analysis → continue/stop
