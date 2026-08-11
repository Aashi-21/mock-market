# Simulation agent (`simulation-agent`)

Standalone **Python / FastAPI** service that reconstructs a full NSE trading day as **375 one-minute bars** from **daily** OHLC (+ soft VWAP).

`backend-app` no longer generates intraday paths in TypeScript. It calls this service via `SIMULATION_AGENT_URL`.

## Why this exists

Daily bars are the only durable historical input. The product still needs minute-by-minute quotes during a simulation day. The agent synthesizes those minutes so that:

| Constraint | Strength |
| --- | --- |
| Day open / high / low / close | **Hard** — path must attain and respect them |
| Day VWAP | **Soft** — nudged via U-shaped volume weights |
| Input `last` / live last price | **Ignored on mismatch** with the reconstructed path |

## Model stack (best-effort realism)

Chosen combination of the discussed options:

1. **Empirical priors** — Parkinson / return vol from prior rows; also median Volume / Trades / %Deliverable when present.
2. **Stochastic volatility** — mean-reverting log-variance driving per-minute diffusion.
3. **Hawkes jumps** — self-exciting intensity; **Trades** (or Volume fallback) set baseline burstiness.
4. **Piecewise Brownian bridge** — anchors open → day-high / day-low (ordered by sampled times) → close.
5. **Soft VWAP** — U-shaped profile scaled to day **Volume**; softness boosted when **%Deliverable** is high.
6. **%Deliverable** — high → quieter jumps (investment-like); low → larger jumps (speculative).
7. **Trade-impact hook** — optional `trade_impacts[]` with temporary + partial permanent displacement.

Currency / venue assumptions: **INR**, **NSE** cash session **09:15–15:30** (375 minutes). Tick rounding uses approximate NSE bands (₹0.05 / ₹0.10).

## Data layout

```
DATA/
  .gitignore          # untracks vendor CSVs; keeps fixtures
  stock_metadata.csv  # committed catalog (Industry + Series)
  MOCK_STOCK1.csv     # committed sample fixture
  {SYMBOL}.csv        # local vendor OHLC files (gitignored)
```

Valid stock universes come from `DATA/stock_metadata.csv` (Industry + Series/Type). Per-symbol OHLC CSVs use the Symbol column (with filename variants for `M&M` → `MM.csv`, `BAJAJ-AUTO.csv`, etc.). Aggregate dumps like `NIFTY50_all.csv` are not treated as stocks. `MOCK_STOCK1` is catalogued with Series=`MOCK`.

### CSV columns

| Column | Meaning |
| --- | --- |
| Date | `YYYY-MM-DD` |
| Symbol | Ignored if it differs from the filename stem |
| Type | Ignored |
| PreviousClose | Previous day’s close |
| Open / High / Low / Close | Day OHLC |
| Last | Day LTP (not forced onto the path) |
| VWAP | Soft target |
| Volume | Scales minute volume path |
| Turnover | Optional; infers Volume if missing |
| Trades | Calibrates Hawkes intensity |
| Deliverable Volume | Optional; with Volume derives % |
| %Deliverble | Jump size + VWAP softness (0–1) |

## Run locally

```bash
cd simulation-agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload
```

Then start `backend-app` with:

```env
SIMULATION_AGENT_URL=http://localhost:8090
```

## HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/stocks` | Catalog from `stock_metadata.csv` (filter `series`, `industry`) |
| POST | `/v1/simulate/day` | Full-day minute simulation (seeded) |
| POST | `/v1/candles` | Minute OHLC candles for charting |
| GET | `/v1/sessions/{id}/minute/{i}` | Fetch minute `i` and optional next bar |
| POST | `/v1/trade-impact/preview` | Stateless impact size helper |

Machine-readable contract: [`schemas/simulation-agent.openapi.json`](./schemas/simulation-agent.openapi.json).

### `POST /v1/simulate/day` body (sketch)

```json
{
  "stock_id": "MOCK_STOCK1",
  "date": "2008-01-02",
  "seed": 42,
  "day_bar": null,
  "trade_impacts": [],
  "persist_session": true
}
```

If `day_bar` is omitted, the agent loads `DATA/{stock_id}.csv` for that date. `backend-app` always sends an explicit `day_bar` from its stock stub/provider so Nifty names work without CSVs.

Same `(stock_id, date, seed, day_bar, trade_impacts)` → same path (seeded).

## Integration with `backend-app`

| Piece | Role |
| --- | --- |
| `src/services/simulationAgentClient.ts` | HTTP client + path resample onto tick grid |
| `src/services/simulationService.ts` | Calls agent at day start; ticks along `closes` |
| `src/utils/pricePath.ts` | **Removed** |

Default wall-clock tick grid is 375 steps (5s ticks × 31m15s), matching one NSE minute per tick at `SIMULATION_TIME_SCALE=1`.

## Future user-trade coupling

Pass impacts when requesting a day:

```json
"trade_impacts": [
  { "minute_index": 120, "side": "BUY", "units": 5000, "aggressiveness": 1.2 }
]
```

Or preview with `POST /v1/trade-impact/preview`. Live mid-session re-simulation can later re-call `/v1/simulate/day` with accumulated impacts for the remaining day.
