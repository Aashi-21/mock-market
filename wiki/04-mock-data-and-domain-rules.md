# Domain rules & market data

Authoritative behaviour lives in `backend-app` + `DATA/`. The UI no longer drives fills from local mock files.

## Auth & cash

| Role | How | Starting cash |
| --- | --- | --- |
| Trader | Signup/login at `/login` (username + password) | ₹0 |
| Admin | `/admin/login` — `rootadmin` / `admin123` (env override) | N/A (cannot trade) |

Credentials and books: `backend-app/local-db/` (gitignored). Details: [10-local-auth-and-admin.md](./10-local-auth-and-admin.md).

## Market date

Simulation dates come from historical CSVs, not `new Date()` on the client.

- Empty books → first day **2008-01-01** (or next available trading day with data)
- After buys → next trading day after `latestBuyDate`

## Stock universe

- Catalog: `DATA/stock_metadata.csv` (symbol, name, industry, series, ISIN, …)
- Daily bars: `DATA/{SYMBOL}.csv` (and naming variants such as `M&M` → `MM.csv`)
- Board / order picker: **all catalog stocks with a resolvable CSV** — no 10-name cap
- Aggregate files like `NIFTY50_all.csv` are ignored

## Portfolio rules

- No max holdings count
- Pre-simulation orders stay `PENDING` until the admin begins a session; they fill at that day’s **open**
- Live orders require `session.status === "TRADING"` and fill at the current quote
- Insufficient cash / units → reject

## Order statuses

`PENDING` · `FILLED` · `CANCELLED` · `REJECTED`

## Simulation clock (admin)

| Control | Default / notes |
| --- | --- |
| Seconds per market minute | `5` (admin console; stored in `local-db/global/config.json`) |
| `SIMULATION_TIME_SCALE` | Optional env divisor on day/tick/analysis durations |
| Max days per session | 10 cycles |
| Who may start/continue/stop | Admin only; trader routes return **403** |

## Legacy frontend mocks

Older files under `web-app-ui/src/data/` (e.g. hard-coded demo user) are not the live path when `VITE_USE_MOCKS=false`. Prefer backend + `local-db`.
