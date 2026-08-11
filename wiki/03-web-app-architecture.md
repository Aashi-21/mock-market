# Web app architecture

Stack: **React 18**, **TypeScript**, **Vite**, **PNPM**, **React Router**.

## Routing

| Path | Access | Screen |
| --- | --- | --- |
| `/login` | Public | Trader signup / sign-in |
| `/dashboard` | Trader token | Pre-simulation home |
| `/simulation` | Trader token | Live board when global session is TRADING/ANALYSIS |
| `/admin/login` | Public | Admin sign-in (`rootadmin`) |
| `/admin` | Admin token (localStorage) | Market control console |
| `/` | Redirect | → `/dashboard` |

`ProtectedRoute` gates trader trees. Admin routes sit **outside** `AuthProvider` and use `authService` admin helpers. `AppShell` wraps trader header + outlet.

## State

### `AuthContext` (traders)

- Session in `localStorage` (`mock-market.auth`).
- Exposes `login`, `signup`, `logout`, `user`, `isAuthenticated`.
- Tokens are opaque `user-token.*` strings from the backend.

### Admin session

- Stored separately (`mock-market.admin` via `authService`).
- Uses `admin-token.*`; rejected on trader market/order routes.

### `AppDataContext`

Owns portfolio, orders, catalog, and the **global** simulation session (long-polled):

- Dashboard while session is idle / absent
- Auto-navigate to `/simulation` when status is `TRADING` or `ANALYSIS`
- Traders do **not** call begin/continue/end — those return 403

Important methods:

- `placeOrder` / `cancelOrder`
- Deposit / reset (trader self-reset)
- Long-poll `/simulation/session`

## UI composition

```
App
 └─ Routes
     ├─ /admin/login → AdminLoginPage
     ├─ /admin → AdminPage
     └─ * → AuthProvider → AppDataProvider
           └─ Routes
               ├─ LoginPage
               └─ ProtectedRoute → AppShell
                     ├─ DashboardPage
                     └─ SimulationPage
```

Admin layout uses `.admin-grid` (not `.dashboard-grid`) so clock / accounts panels get explicit column spans.

## Styling

Global CSS in `src/index.css` with design tokens (`--ink`, `--accent`, fonts). No CSS framework.

## Config

`src/config.ts` exposes:

- `VITE_API_BASE_URL`
- `VITE_BACKEND_API_KEY`
- `VITE_STOCK_DATA_API_KEY`
- `useMocks` (keep `false` when talking to `backend-app`)
