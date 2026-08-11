# Mock Market

Replay the Indian NSE with historical data. Practice portfolio construction and simulated trading.

## Layout

| Path | Description |
| --- | --- |
| [`simulation-agent/`](./simulation-agent) | Python FastAPI — seeded minute paths from daily OHLC |
| [`DATA/`](./DATA) | Daily OHLC+VWAP CSVs (`MOCK_STOCK1.csv` sample) |
| [`backend-app/`](./backend-app) | Express + TypeScript API + simulation engine |
| [`web-app-ui/`](./web-app-ui) | React + TypeScript frontend |
| [`wiki/`](./wiki) | Docs for humans and AI agents |

## Quick start

```bash
# terminal 1 — intraday simulator
cd simulation-agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --port 8090 --reload

# terminal 2
cd backend-app
cp .env.example .env
pnpm install
pnpm dev

# terminal 3
cd web-app-ui
cp .env.example .env
pnpm install
pnpm dev
```

- Login / signup: http://localhost:5173/login  
- Admin: http://localhost:5173/admin/login (`rootadmin` / `admin123`)  
- API: http://localhost:8080/api  
- Agent: http://localhost:8090/health  

Local trader data lives in `backend-app/local-db/` (gitignored). See [wiki/10-local-auth-and-admin.md](./wiki/10-local-auth-and-admin.md).
