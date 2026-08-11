# Mock Market — Simulation Agent

Seeded Python service that turns **daily NSE OHLC (+ soft VWAP)** into a full **375-minute** intraday path.

## Model (high level)

| Layer | Role |
| --- | --- |
| Empirical priors | Parkinson / return vol from that stock’s prior daily rows |
| Stochastic volatility | Mean-reverting log-variance → per-minute diffusion |
| Hawkes jumps | Self-exciting burst clustering |
| Piecewise Brownian bridge | Anchors open → high/low → close |
| Hard OHLC | Exact day open/high/low/close enforced |
| Soft VWAP | U-shaped volume profile + gentle path nudge |
| Trade impact (hook) | Temporary + partial permanent displacement for future user flow |

## Run

```bash
cd simulation-agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload
```

Health: http://localhost:8090/health  
OpenAPI: http://localhost:8090/docs

## Data

CSV files live in repo-root `DATA/`. The universe is defined by `stock_metadata.csv` (includes `MOCK_STOCK1` with Series=`MOCK`). OHLC files are resolved from Symbol (e.g. `M&M` → `MM.csv`). Only `MOCK_STOCK1.csv` and `stock_metadata.csv` are committed; other CSVs are gitignored.

## Example

```bash
curl -s http://localhost:8090/v1/simulate/day \
  -H 'Content-Type: application/json' \
  -d '{"stock_id":"MOCK_STOCK1","date":"2008-01-02","seed":42}'
```

See `wiki/09-simulation-agent.md`.
