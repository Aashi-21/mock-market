# AI agent guide

Instructions for coding agents editing this repository.

## Do

- Prefer changing `services/` + `localDb/` when backend behaviour changes; keep pages thin.
- Prefer changing `simulation-agent/app/model/` for path realism; keep `backend-app` as the day clock.
- Preserve domain invariants: historical market date, admin-only start/stop, full catalog (no artificial 3/10 caps).
- Update `wiki/` when product rules or folder responsibilities change.
- Keep TypeScript strict; avoid `any`. Match ESM imports (no CommonJS `require` in `backend-app`).
- Match existing visual language in `index.css` (ink / teal / paper) — do not introduce purple-gradient or generic AI dashboard themes.
- Use dedicated layout classes for admin (`.admin-grid`); do not reuse `.dashboard-grid` child selectors unless panels have the matching classes.
- Use PNPM only (`pnpm add`, `pnpm install`); do not introduce npm/yarn lockfiles.
- Do not commit vendor CSVs under `DATA/` other than `MOCK_STOCK1.csv` (+ keep `stock_metadata.csv`).
- Never commit `backend-app/local-db/` or cleartext credentials files.

## Don’t

- Commit `.env` or real API keys.
- Call real broker / paid market APIs from the client without an explicit task.
- Reintroduce holdings/board size limits without an explicit product request + wiki update.
- Add heavy UI libraries unless requested.
- Use wall-clock `new Date()` as the market/simulation date.
- Let traders begin/continue/end the global simulation.

## Touch points for common tasks

| Task | Start here |
| --- | --- |
| Change simulation timing | Admin config + `simulationService` / `SIMULATION_TIME_SCALE` |
| Change intraday path model | `simulation-agent/app/model/*` |
| Add / inspect daily CSV fixtures | `DATA/` + `wiki/schemas/data-csv.schema.json` |
| Local auth / admin | `backend-app/src/services/authService.ts`, `localDb/*`, wiki `10-*` |
| Replace Firebase stubs (future) | `backend-app/src/stubs/firebase*.ts` |
| Replace stock OHLC API (future) | `backend-app/src/stubs/stockPriceApi.ts` |
| UI API wiring | `web-app-ui/src/services/marketApi.ts`, `authService.ts` |
| Long-poll / session UI | `web-app-ui/src/context/AppDataContext.tsx` |
| Admin console | `web-app-ui/src/pages/AdminPage.tsx` |
| Styling | `web-app-ui/src/index.css` |

## Verification checklist

1. `cd simulation-agent && source .venv/bin/activate && python -c "from app.main import app"`
2. `cd backend-app && pnpm typecheck`
3. `cd web-app-ui && pnpm build`
4. Manual: agent up → admin begin → trader signup/deposit/pre-order → live trade → analysis → admin continue/stop → reset
