# Mock Market Wiki

Documentation for humans and AI agents working on this repository.

## Index

| Doc | Audience | Purpose |
| --- | --- | --- |
| [Project overview](./01-project-overview.md) | Both | What Mock Market is and product rules |
| [Repository map](./02-repository-map.md) | Both | Where code and docs live |
| [Web app architecture](./03-web-app-architecture.md) | Both | UI layers, routing, state |
| [Mock data & domain rules](./04-mock-data-and-domain-rules.md) | Both | Catalog, cash, orders, dates |
| [Local development](./05-local-development.md) | Humans | Setup, env vars, scripts |
| [AI agent guide](./06-ai-agent-guide.md) | AI | Conventions when editing this codebase |
| [Roadmap stubs](./07-roadmap-stubs.md) | Both | Planned Firebase / stock API cutover |
| [Backend app](./08-backend-app.md) | Both | Express API, simulation engine, routes |
| [Simulation agent](./09-simulation-agent.md) | Both | Python intraday OHLC simulator |
| [Local auth & admin](./10-local-auth-and-admin.md) | Both | CSV users, admin clock, local-db |
| [OpenAPI (simulation-agent)](./schemas/simulation-agent.openapi.json) | Machine | HTTP contract for the Python agent |
| [CSV schema](./schemas/data-csv.schema.json) | Machine | `DATA/{STOCK_ID}.csv` column contract |

## Quick facts

- Frontend: `web-app-ui/` (React + TypeScript + PNPM + Vite)
- Backend: `backend-app/` (Express + TypeScript + PNPM)
- Simulation agent: `simulation-agent/` (Python + FastAPI) — seeded minute paths from daily OHLC
- Market CSVs: `DATA/` (`MOCK_STOCK1.csv` + `stock_metadata.csv` committed)
- Persistence: `backend-app/local-db/` (CSV/JSON, **gitignored**)

- Trader signup/login is **local username/password** (cleartext CSV); admin is separate (`/admin`)
- Only **admin** begins / continues / ends the global simulation
- Holding count and board size limits are **removed** — full catalog with CSV is tradable
- Empty portfolio simulations start on **1 Jan 2008**
- Default clock: **5 wall seconds = 1 market minute** (admin-configurable; also scaled by `SIMULATION_TIME_SCALE`)
- Firebase Auth/RTDB and a vendor historical stock API remain **stubbed** for a later cutover
