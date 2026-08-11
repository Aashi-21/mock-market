# Project overview

Mock Market is a web application that lets traders practice against a **replay of the Indian equity market** driven by historical NSE data.

## Product goals

1. Traders sign up / sign in with a local username and password.
2. Land on a **dashboard** (home until logout) with cash, holdings, and growth.
3. Queue **pre-simulation** orders; wait for an **admin** to open the market clock.
4. During a live session, trade any catalog stock that has a daily CSV under `DATA/`.
5. Admin controls timing, begin / continue / end, and can reset trader books.

## Non-goals (current phase)

- Real brokerage execution
- Live market feeds
- Identity provider / OAuth (local CSV auth instead)
- Production-hardened password storage (cleartext by design for local demos)

## Core constraints

| Rule | Detail |
| --- | --- |
| Exchange | NSE only (for this simulation) |
| Holdings limit | None — any number of distinct symbols |
| Simulation universe | Full catalog entries that have a resolvable CSV |
| Clock | Historical market date, not wall-clock “today” |
| Who starts the clock | **Admin only** (`rootadmin`) |
| Trader start cash | ₹0 (deposit via wallet) |
| Intraday prices | `simulation-agent` from daily OHLC (hard) + VWAP (soft) |

## User journey

```
Admin:  /admin/login → set timing → Begin simulation → Continue / End → reset accounts

Trader: /login (signup) → Dashboard
          ├─ Deposit cash, view growth + holdings
          ├─ Place / cancel pre-simulation orders
          └─ When admin opens the tape → /simulation
                ├─ Full catalog board + candles
                ├─ Live buy/sell (mock fill)
                └─ Analysis wait → admin continues or ends
```

See [Local auth & admin](./10-local-auth-and-admin.md) for credentials and `local-db` layout.
