# Roadmap stubs

Planned follow-ups. Several earlier “mock → backend” items are already in place via `backend-app` + `local-db`.

## Done locally (demo-grade)

- Server-authoritative orders, cash checks, and fills
- Per-user persistence (CSV under `local-db/`)
- Global simulation session with admin start/continue/stop
- Catalog-driven board from `DATA/stock_metadata.csv` + daily CSVs
- Intraday paths from `simulation-agent`

## Backend / identity (still open)

- Replace cleartext local auth with IDAM (OIDC / enterprise SSO) or hashed passwords
- Optional Firebase Auth / RTDB cutover (`src/stubs/firebase*.ts`)
- Hardened multi-instance session store (beyond single-process memory + JSON)

## Stock market data

- Broader committed fixtures beyond `MOCK_STOCK1` (most `DATA/*.csv` stay gitignored)
- Vendor historical OHLC provider instead of / in addition to local CSVs
- Ensure every traded symbol always resolves for the active date

## Product enhancements (not started)

- Order types beyond market-at-quote (limit, stop)
- Performance analytics beyond the simple growth chart
- Watchlists independent of the live board
- Stronger admin RBAC if more operator roles appear

When any item above lands, update this file and the architecture docs in the same PR.
