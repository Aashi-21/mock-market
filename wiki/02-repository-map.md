# Repository map

```
mock-market/
├── README.md
├── .gitignore
├── DATA/                      # Daily OHLC+VWAP CSVs (MOCK_STOCK1 + stock_metadata committed)
├── wiki/                      # Human + AI documentation
│   └── schemas/               # Machine-readable OpenAPI / CSV contracts
├── simulation-agent/          # Python FastAPI intraday simulator
│   └── app/
│       ├── api/               # Routes + Pydantic schemas
│       ├── data/              # CSV loader
│       ├── model/             # Bridge, SV, Hawkes, VWAP, trade impact
│       └── services/          # Day orchestration + session store
├── backend-app/               # Express + TypeScript API
│   ├── local-db/              # Gitignored CSV/JSON user + global state
│   ├── src/
│   │   ├── localDb/           # users.csv + per-user books + global config/session
│   │   ├── routes/            # HTTP handlers (trader + admin)
│   │   ├── services/          # Auth, orders, simulation, agent client
│   │   ├── stubs/             # Legacy Firebase + stock API placeholders
│   │   ├── store/             # In-memory account cache over local-db
│   │   └── utils/
│   ├── .env / .env.example
│   └── package.json
└── web-app-ui/                # React + TypeScript frontend
    ├── src/
    │   ├── services/          # marketApi + authService (trader + admin)
    │   ├── context/           # Auth, app data + long-poll
    │   ├── pages/             # Login, Dashboard, Simulation, Admin*
    │   └── components/
    ├── .env / .env.example
    └── package.json
```

## Ownership boundaries

| Path | Responsibility |
| --- | --- |
| `simulation-agent/` | Seeded minute OHLC paths from daily bars |
| `DATA/` | Per-stock daily CSV inputs + `stock_metadata.csv` catalog |
| `backend-app/src/localDb/*` | Cleartext persistence for users and global sim config |
| `backend-app/src/services/simulationService.ts` | Global day clock (admin-driven), ticks, analysis |
| `backend-app/src/services/simulationAgentClient.ts` | HTTP → simulation-agent |
| `backend-app/src/services/authService.ts` | Trader signup/login + admin token checks |
| `backend-app/src/stubs/*` | Optional future Firebase / vendor wiring |
| `web-app-ui/src/pages/AdminPage.tsx` | Admin console UI |
| `web-app-ui/src/services/marketApi.ts` | Authenticated trader API calls |
| `web-app-ui/src/context/AppDataContext.tsx` | Long-poll + UI session state |
| `wiki/` | Durable explanations; update with rule changes |
