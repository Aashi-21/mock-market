# Web app architecture

Stack: **React 18**, **TypeScript**, **Vite**, **PNPM**, **React Router**.

## Routing

| Path | Access | Screen |
| --- | --- | --- |
| `/login` | Public | Mock login |
| `/dashboard` | Authenticated | Home / pre-simulation |
| `/simulation` | Authenticated + phase `RUNNING` | Live mock trading |
| `/` | Redirect | → `/dashboard` |

`ProtectedRoute` gates authenticated trees. `AppShell` wraps the header + main outlet.

## State

### `AuthContext`

- Stores mock JWT session in `localStorage` key `mock-market.auth`.
- Exposes `login`, `logout`, `user`, `isAuthenticated`.

### `AppDataContext`

Owns portfolio, orders, market date, simulation board, and phase:

- `PRE_SIMULATION` — dashboard mode; orders queue until start
- `RUNNING` — simulation mode; buys/sells fill immediately (mock)

Important methods:

- `placeOrder` / `cancelOrder`
- `beginSimulation` — fills pending pre-orders, builds 10-stock board, sets phase
- `endSimulation` — returns to pre-simulation without clearing portfolio

## UI composition

```
App
 └─ AuthProvider
     └─ AppDataProvider
         └─ Routes
             ├─ LoginPage
             └─ ProtectedRoute → AppShell
                   ├─ DashboardPage
                   └─ SimulationPage
```

## Styling

Global CSS in `src/index.css` with design tokens (`--ink`, `--accent`, fonts). No CSS framework. Motion is limited to intentional entrance / chart / brand animations.

## Config

`src/config.ts` exposes:

- `VITE_API_BASE_URL`
- `VITE_BACKEND_API_KEY`
- `VITE_STOCK_DATA_API_KEY`
- `useMocks: true` (flip when real APIs arrive)
