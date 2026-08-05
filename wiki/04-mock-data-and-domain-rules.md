# Mock data & domain rules

Until the backend ships, all market and portfolio behaviour is local.

## Mock credentials

| Field | Value |
| --- | --- |
| Email | `trader@mockmarket.in` |
| Password | `demo1234` |
| Display name | Aarav Mehta |
| Starting cash | ₹2,50,000 |

Defined in `web-app-ui/src/data/mockUser.ts`.

## Market date

`LATEST_MARKET_DATE` in `mockMarket.ts` is currently **2024-12-27**.

This value is shown as “Market date” and is the default simulation start point. It must **not** be confused with `new Date()` on the client.

## Stock universe

`NIFTY50_POOL` holds a curated subset of Nifty 50 names. The simulation board is built by `buildSimulationUniverse(holdings)`:

1. Add every non-zero holding’s symbol (must exist in the pool).
2. Fill remaining slots from the pool until **10** stocks.
3. Return that list for the simulation table and order picker.

## Portfolio rules

- Max **3** symbols with `units > 0` (`MAX_PORTFOLIO_HOLDINGS`).
- Buying a 4th distinct name is rejected.
- Selling down to zero frees a slot.
- Pre-simulation orders stay `PENDING` until `beginSimulation`.
- Live simulation orders fill at last traded price and update cash/holdings immediately.

## Order statuses

`PENDING` · `FILLED` · `CANCELLED` · `REJECTED`

## Replacing mocks

When APIs arrive:

1. Keep types in `src/types` as the contract surface.
2. Replace bodies in `src/services/*` with `fetch`/`axios` using `config.apiBaseUrl` + API keys.
3. Leave components/pages untouched where possible.
4. Set `config.useMocks = false`.
