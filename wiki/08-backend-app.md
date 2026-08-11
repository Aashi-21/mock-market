# Backend app (`backend-app`)

Express + TypeScript API: local auth, CSV/JSON persistence, and the global simulation clock.

## Run

```bash
cd backend-app
cp .env.example .env
pnpm install
pnpm dev
```

Default: `http://localhost:8080/api`

## API surface

### Trader auth & account

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/signup` | No | Create username/password; start cash ₹0 |
| POST | `/auth/login` | No | Issue `user-token.*` |
| GET | `/user/bootstrap` | User | User, portfolio, orders, ledger, session, **full catalog** |
| GET | `/stocks` | User | Listing from `DATA/stock_metadata.csv` |
| GET | `/market/candles/:symbol?date=` | User | Minute candles via simulation-agent |
| POST | `/user/reset` | User | Empty that trader’s books |
| POST | `/wallet/deposit` | User | Add cash `{ amount }` |
| POST | `/orders` | User | Place order (`PRE_SIMULATION` \| `LIVE`) |
| DELETE | `/orders/:id` | User | Cancel pending pre-order |
| GET | `/simulation/session` | User | Long-poll (`sinceVersion`, `waitMs`) |
| POST | `/simulation/start\|continue\|stop` | — | Always **403** (admin only) |

### Admin

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/admin/login` | No | Issue `admin-token.*` |
| GET | `/admin/overview` | Admin | Config + session + all trader books |
| POST | `/admin/simulation/config` | Admin | `{ secondsPerMarketMinute }` |
| POST | `/admin/simulation/start` | Admin | Begin global session |
| POST | `/admin/simulation/continue` | Admin | Next day after analysis |
| POST | `/admin/simulation/stop` | Admin | End session |
| POST | `/admin/users/reset-all` | Admin | Wipe every trader account |
| POST | `/admin/users/:userId/reset` | Admin | Wipe one trader |

Admin tokens are rejected on trader trading/candle routes. See [10-local-auth-and-admin.md](./10-local-auth-and-admin.md).

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
2. **Universe** — catalog symbols with a resolvable daily CSV (no fixed board size of 10).
3. **Pre-orders** execute at that day’s **open** and write ledger rows.
4. **Timing**
   - Admin sets **seconds per market minute** (default `5`)
   - Optional `SIMULATION_TIME_SCALE` further shortens wall durations
   - Analysis window after the close; max **10** days per session
5. **Prices**
   - Daily OHLC/VWAP from `DATA/` (+ stock API stub where still used)
   - Intraday path from **simulation-agent** (`SIMULATION_AGENT_URL`)
   - Client: `src/services/simulationAgentClient.ts`
6. **Live trades** fill at the quote shown to the client at request time.
7. **Analysis** — traders wait; only admin continues or stops.

## Persistence

`src/localDb/` + `src/store/memoryStore.ts` load/save:

- `local-db/users.csv` and `local-db/users/{id}/*.csv`
- `local-db/global/config.json`, `local-db/global/session.json`

## Required sidecar

```bash
cd simulation-agent && source .venv/bin/activate && uvicorn app.main:app --port 8090
```

See [09-simulation-agent.md](./09-simulation-agent.md).

## Stubs still present (future cutover)

| File | Future wiring |
| --- | --- |
| `src/stubs/firebaseAuth.ts` | Firebase Auth / IDAM token verify |
| `src/stubs/firebaseDb.ts` | Firebase Realtime Database |
| `src/stubs/stockPriceApi.ts` | Historical OHLC provider |

## Integration with `web-app-ui`

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_USE_MOCKS=false
```

Trader calls go through `marketApi.ts`; admin through `authService.adminFetch`.
