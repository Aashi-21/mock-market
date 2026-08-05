# backend-app

Express + TypeScript API for Mock Market.

## Quick start

```bash
cd backend-app
cp .env.example .env
pnpm install
pnpm dev
```

Server: `http://localhost:8080/api`

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Watch mode via `tsx` |
| `pnpm build` | Compile to `dist/` |
| `pnpm start` | Run compiled server |
| `pnpm typecheck` | Typecheck only |

## Auth (stub)

`POST /api/auth/login` with `trader@mockmarket.in` / `demo1234`

Firebase Auth is stubbed in `src/stubs/firebaseAuth.ts`.

## Key routes

| Method | Path | Description |
| --- | --- | --- |
| POST | `/auth/login` | Mock Firebase login |
| GET | `/user/bootstrap` | User + portfolio + ledger + session |
| POST | `/user/reset` | Wipe portfolio / ledger / sim date |
| POST | `/wallet/deposit` | Add cash |
| POST | `/orders` | Place `PRE_SIMULATION` or `LIVE` order |
| DELETE | `/orders/:id` | Cancel pending pre-order |
| POST | `/simulation/start` | Start session (executes pre-orders) |
| POST | `/simulation/continue` | Next day after analysis |
| POST | `/simulation/stop` | End session, persist ledger |
| GET | `/simulation/session` | Long-poll live quotes (`sinceVersion`) |

See `../wiki/08-backend-app.md` for simulation timing and stubs.
