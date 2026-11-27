# typo — server

Placeholder. Planned for Phase 4 (see the roadmap):

- `GET /api/map/today` — server-generated daily map
- `POST /api/score` — submit keystroke log; server replays & validates
- Daily leaderboards (mobile vs keyboard), percentiles

Backend choice is still open (Cloudflare Workers + D1 preferred, or Supabase). The API will
be served from the same origin as the client (`typo.bluedotstudios.io/api/*`).
