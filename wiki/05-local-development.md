# Local development

## Prerequisites

- Node.js 20+
- PNPM 9+ (`npm install -g pnpm@9` if needed)
- Python 3.11+ (for `simulation-agent`)

## Simulation agent (required for live quotes)

```bash
cd simulation-agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload
```

Agent: [http://localhost:8090/health](http://localhost:8090/health)

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
| `SIMULATION_TIME_SCALE` | Divides day/tick/analysis durations |
| `SIMULATION_AGENT_URL` | Python agent base URL (default `http://localhost:8090`) |
| `SIMULATION_AGENT_API_KEY` | Optional shared secret for agent calls |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin console credentials (defaults `rootadmin` / `admin123`) |
| `STOCK_DATA_API_KEY` | Reserved for future OHLC provider |
| `FIREBASE_*` | Reserved for Auth/RTDB |

Trader data is written under `backend-app/local-db/` (gitignored). Delete that folder to wipe local users/sessions.

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

## Suggested flow

1. Start `simulation-agent`
2. Start `backend-app`
3. Start `web-app-ui`
4. Open `/admin/login` → set seconds/minute → **Begin simulation**
5. In another browser profile (or after admin sign-out), `/login` → signup → deposit → queue pre-orders
6. Trader is pulled into `/simulation` while the global session is TRADING/ANALYSIS
7. Admin continues or ends; optionally reset one/all accounts
