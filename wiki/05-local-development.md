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
| `SIMULATION_TIME_SCALE` | Divides day/tick/analysis durations (`60` ≈ 31s/day) |
| `SIMULATION_AGENT_URL` | Python agent base URL (default `http://localhost:8090`) |
| `SIMULATION_AGENT_API_KEY` | Optional shared secret for agent calls |
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

1. Start `simulation-agent`
2. Start `backend-app`
3. Start `web-app-ui`
4. Sign in → deposit/reset as needed → queue pre-orders → begin simulation
5. Watch quotes update via long-poll → trade → analysis → continue/stop
