# AI agent guide

Instructions for coding agents editing this repository.

## Do

- Prefer changing `services/` + `data/` when backend behaviour changes; keep pages thin.
- Prefer changing `simulation-agent/app/model/` for path realism; keep `backend-app` as the day clock.
- Preserve domain invariants: max 3 holdings, 10-name board, historical market date.
- Update `wiki/` when product rules or folder responsibilities change.
- Keep TypeScript strict; avoid `any`.
- Match existing visual language in `index.css` (ink / teal / paper) — do not introduce purple-gradient or generic AI dashboard themes.
- Use PNPM only (`pnpm add`, `pnpm install`); do not introduce npm/yarn lockfiles.
- Do not commit vendor CSVs under `DATA/` other than `MOCK_STOCK1.csv`.

## Don’t

- Commit `.env` or real API keys.
- Call real broker / paid market APIs from the client without an explicit task.
- Raise the holdings limit or board size without updating wiki + types constants.
- Add heavy UI libraries unless requested.
- Use wall-clock `new Date()` as the market/simulation date.

## Touch points for common tasks

| Task | Start here |
| --- | --- |
| Change simulation timing | `backend-app/src/types` constants + `SIMULATION_TIME_SCALE` |
| Change intraday path model | `simulation-agent/app/model/*` |
| Add / inspect daily CSV fixtures | `DATA/` + `wiki/schemas/data-csv.schema.json` |
| Replace Firebase auth | `backend-app/src/stubs/firebaseAuth.ts` |
| Replace Firebase RTDB | `backend-app/src/stubs/firebaseDb.ts` |
| Replace stock OHLC API | `backend-app/src/stubs/stockPriceApi.ts` |
| UI API wiring | `web-app-ui/src/services/marketApi.ts` |
| Long-poll / session UI | `web-app-ui/src/context/AppDataContext.tsx` |
| Styling | `web-app-ui/src/index.css` |

## Verification checklist

1. `cd simulation-agent && source .venv/bin/activate && python -c "from app.main import app"`
2. `cd backend-app && pnpm typecheck`
3. `cd web-app-ui && pnpm build`
4. Manual: agent up → login → deposit → pre-order → start → live trade → analysis → continue/stop → reset
