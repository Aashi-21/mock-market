# Backend app (`backend-app`)

Express + TypeScript API that owns authentication stubs, portfolio/ledger persistence stubs, and the live simulation engine.

## Run

```bash
cd backend-app
cp .env.example .env
pnpm install
pnpm dev
```

Default: `http://localhost:8080/api`  
Local `.env` sets `SIMULATION_TIME_SCALE=60` so a market day lasts ~31s instead of 31m15s.

## API surface

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | No | Firebase-auth stub login |
| GET | `/user/bootstrap` | Bearer | User, portfolio, orders, ledger, session |
| POST | `/user/reset` | Bearer | Empty portfolio/ledger; sim date → 2008-01-01 |
| POST | `/wallet/deposit` | Bearer | Add cash `{ amount }` |
| POST | `/orders` | Bearer | Place order (`PRE_SIMULATION` \| `LIVE`) |
| DELETE | `/orders/:id` | Bearer | Cancel pending pre-order |
| POST | `/simulation/start` | Bearer | Start session; fill pre-orders at open |
| POST | `/simulation/continue` | Bearer | Next day after analysis |
| POST | `/simulation/stop` | Bearer | End session; persist ledger |
| GET | `/simulation/session` | Bearer | Long-poll (`sinceVersion`, `waitMs`) |

### Order body

```json
{
  "symbol": "RELIANCE",
  "side": "BUY",
  "units": 10,
  "kind": "PRE_SIMULATION",
  "simulationCycle": null
}
```

`LIVE` orders require `session.status === "TRADING"` and fill at the current quote.

## Simulation rules

1. **Start date**
   - Empty portfolio + no buys → `2008-01-01`
   - Else → next trading day after `latestBuyDate`
2. **Pre-orders** execute at that day’s **open** and write ledger rows.
3. **Timing** (before `SIMULATION_TIME_SCALE`)
   - 31m 15s = 1 market day
   - Quote tick every 5s
   - 5m analysis after the close
   - Max **10** days per session
4. **Prices**
   - Open/close from stock API stub (`src/stubs/stockPriceApi.ts`)
   - Intraday path = Brownian-bridge style walk open → close (`src/utils/pricePath.ts`)
5. **Live trades** fill at the quote shown to the client at request time.
6. **Analysis** — user may continue or stop; no live orders.

## Stubs to replace later

| File | Future wiring |
| --- | --- |
| `src/stubs/firebaseAuth.ts` | Firebase Auth / IDAM token verify |
| `src/stubs/firebaseDb.ts` | Firebase Realtime Database |
| `src/stubs/stockPriceApi.ts` | Historical OHLC provider |

## Integration with `web-app-ui`

UI calls these endpoints via `src/services/marketApi.ts` and long-polls while `TRADING` / `ANALYSIS`. Set:

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_USE_MOCKS=false
```
