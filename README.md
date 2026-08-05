# Mock Market

Replay the Indian NSE with historical data. Practice portfolio construction and simulated trading.

## Layout

| Path | Description |
| --- | --- |
| [`backend-app/`](./backend-app) | Express + TypeScript API + simulation engine |
| [`web-app-ui/`](./web-app-ui) | React + TypeScript frontend |
| [`wiki/`](./wiki) | Docs for humans and AI agents |

## Quick start

```bash
# terminal 1
cd backend-app
cp .env.example .env
pnpm install
pnpm dev

# terminal 2
cd web-app-ui
cp .env.example .env
pnpm install
pnpm dev
```

- API: http://localhost:8080/api  
- UI: http://localhost:5173  
- Login: `trader@mockmarket.in` / `demo1234`

See [wiki/05-local-development.md](./wiki/05-local-development.md) and [wiki/08-backend-app.md](./wiki/08-backend-app.md).
