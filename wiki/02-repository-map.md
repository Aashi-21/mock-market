# Repository map

```
mock-market/
├── README.md
├── .gitignore
├── DATA/                      # Daily OHLC+VWAP CSVs (MOCK_STOCK1 committed)
├── wiki/                      # Human + AI documentation
│   └── schemas/               # Machine-readable OpenAPI / CSV contracts
├── simulation-agent/          # Python FastAPI intraday simulator
│   └── app/
│       ├── api/               # Routes + Pydantic schemas
│       ├── data/              # CSV loader
│       ├── model/             # Bridge, SV, Hawkes, VWAP, trade impact
│       └── services/          # Day orchestration + session store
├── backend-app/               # Express + TypeScript API
│   ├── src/
│   │   ├── routes/            # HTTP handlers
│   │   ├── services/          # Auth, orders, simulation engine, agent client
│   │   ├── stubs/             # Firebase + stock API placeholders
│   │   ├── store/             # In-memory session + account helpers
│   │   └── utils/             # Dates / helpers
│   ├── .env / .env.example
│   └── package.json
└── web-app-ui/                # React + TypeScript frontend
    ├── src/
    │   ├── services/          # HTTP client → backend-app
    │   ├── context/           # Auth, theme, app data + long-poll
    │   ├── pages/
    │   └── components/
    ├── .env / .env.example
    └── package.json
```

## Ownership boundaries

| Path | Responsibility |
| --- | --- |
| `simulation-agent/` | Seeded minute OHLC paths from daily bars |
| `DATA/` | Per-stock daily CSV inputs |
| `backend-app/src/services/simulationService.ts` | Day clock, ticks, analysis, start/stop |
| `backend-app/src/services/simulationAgentClient.ts` | HTTP → simulation-agent |
| `backend-app/src/stubs/*` | Replace with Firebase / market vendor |
| `web-app-ui/src/services/marketApi.ts` | All authenticated API calls |
| `web-app-ui/src/context/AppDataContext.tsx` | Long-poll + UI session state |
| `wiki/` | Durable explanations; update with rule changes |
