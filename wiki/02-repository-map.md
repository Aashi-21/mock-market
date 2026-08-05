# Repository map

```
mock-market/
├── README.md
├── .gitignore
├── wiki/                      # Human + AI documentation
├── backend-app/               # Express + TypeScript API
│   ├── src/
│   │   ├── routes/            # HTTP handlers
│   │   ├── services/          # Auth, orders, simulation engine
│   │   ├── stubs/             # Firebase + stock API placeholders
│   │   ├── store/             # In-memory session + account helpers
│   │   └── utils/             # Price path, dates
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
| `backend-app/src/services/simulationService.ts` | Day clock, ticks, analysis, start/stop |
| `backend-app/src/stubs/*` | Replace with Firebase / market vendor |
| `web-app-ui/src/services/marketApi.ts` | All authenticated API calls |
| `web-app-ui/src/context/AppDataContext.tsx` | Long-poll + UI session state |
| `wiki/` | Durable explanations; update with rule changes |
