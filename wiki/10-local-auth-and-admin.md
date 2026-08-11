# Local auth, admin control & persistence

## Trader accounts

- Sign up / sign in at `/login` with a chosen **username** + password.
- Credentials and books are stored in cleartext under `backend-app/local-db/` (**gitignored**).
- New accounts start with **₹0** (use `/wallet/deposit`).
- Username `rootadmin` is reserved and cannot be registered.
- Holding count and board size limits are **removed** — traders may buy any catalog stock with a CSV.
- Session token shape: `user-token.{userId}.{timestamp}`.

## Admin

| Item | Value |
| --- | --- |
| URL | `/admin/login` → `/admin` |
| Username | `rootadmin` (`ADMIN_USERNAME`) |
| Password | `admin123` (`ADMIN_PASSWORD`) |
| Token | `admin-token.{username}.{timestamp}` |

Admin can:

- Set **seconds per market minute** (default `5` → 5s wall = 1 market minute)
- **Begin / continue / end** the global simulation
- **Reset all** or **reset one** trader account
- Monitor holdings, pending orders, and recent ledger rows (`GET /admin/overview`)

Admin **cannot** trade or call trader market/candle routes (admin token is rejected there).

Traders **cannot** begin or end the simulation (`POST /simulation/start|continue|stop` → **403**). The UI long-polls the global session and routes into `/simulation` when status is `TRADING` or `ANALYSIS`.

## Admin UI notes

- Layout uses `.admin-grid` / `.admin-grid__clock` / `.admin-grid__accounts` in `web-app-ui/src/index.css`.
- Do not place admin panels in `.dashboard-grid` without the dashboard panel classes — those nth-child / growth-panel rules will collapse columns.

## Local DB layout

```
backend-app/local-db/
  users.csv
  users/{userId}/holdings.csv
  users/{userId}/orders.csv
  users/{userId}/ledger.csv
  users/{userId}/growth.csv
  global/config.json
  global/session.json
```

Code: `backend-app/src/localDb/userStore.ts`, `globalStore.ts`, plus `store/memoryStore.ts` as the in-process cache.

## Related docs

- API table: [08-backend-app.md](./08-backend-app.md)
- Dev flow: [05-local-development.md](./05-local-development.md)
