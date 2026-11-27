# typo

A daily side-scrolling parkour game where you type words to move.

- `client/` — Vite + TypeScript + PixiJS game
- `server/` — API (daily map, scores, leaderboards) — not built yet

## Running the client

```sh
cd client
npm install
npm run dev        # http://localhost:5173 (also exposed on your LAN for phone testing)
npm run build      # type-check + production build into client/dist
```

Requires Node 20+.
