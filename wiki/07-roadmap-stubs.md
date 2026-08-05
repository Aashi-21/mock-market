# Roadmap stubs

Planned follow-ups once backend and market data services exist.

## Backend API

- Replace mock services with REST/GraphQL clients.
- Persist portfolio, orders, and simulation sessions per user.
- Server-authoritative fill logic and cash checks.

## Stock market data

- Ingest historical NSE OHLCV for Nifty 50 (and later broader NSE).
- Drive simulation clock day-by-day from the dataset.
- Ensure portfolio symbols always resolve in the active universe.

## Identity

- Replace mock login with IDAM (OIDC / enterprise SSO).
- Remove hardcoded credentials from `mockUser.ts`.
- Map IDAM subject → trading account.

## Product enhancements (not started)

- Multi-day step / play-pause controls for the simulation clock
- Order types beyond market-at-LTP (limit, stop)
- Performance analytics beyond the simple growth chart
- Watchlists independent of the 10-name board

When any item above lands, update this file and the architecture docs in the same PR.
