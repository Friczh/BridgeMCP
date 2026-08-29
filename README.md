# bridgemcp-frontend

Vue 3 + TS + Vite + Tailwind rewrite of the Pages dashboard, per design.md.

## Setup

```
cp .env.example .env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_WORKER_URL
npm install
npm run dev
```

## Build

```
npm run build     # runs vue-tsc typecheck, then vite build -> dist/
```

Deploy `dist/` to Cloudflare Pages. Set the three `VITE_*` vars as Pages
build-time env vars (or per-branch) — no other secrets belong in Pages;
everything else stays a Worker secret per design.md's hygiene section.

## Structure

- `src/api/` — typed Worker client, locked error-message mapping
- `src/composables/` — session, theme, sidebar, global popup, shared counts
- `src/components/` — Pane (signature bordered-panel element), Popup/Select
  (Reka UI headless), Sidebar, StatusLine, Button, EmptyState
- `src/views/` — Home (placeholder), Login, Dashboard, Connections, Tokens,
  Audit, Settings
- `src/router/` — `/`, `/login`, `/dashboard/*` with an auth guard

Typechecked (`vue-tsc -b`) and production build both verified clean.
