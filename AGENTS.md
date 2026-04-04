# Agent instructions — WealthManager

This file is for **AI coding agents** (Cursor, etc.) working in this repository. Human-oriented docs live in the root [README.md](README.md) and per-package READMEs.

## What this repo is

**WealthManager** — personal finance platform: **Bun + Elysia** API, **React** PWA (`web_application/`), optional **Expo** mobile app (`frontend/`), and a **showcase** marketing site (`showcase_website/`).

**Bun workspaces** (root `package.json`): `backend`, `web_application`, `showcase_website`. The **mobile app** in `frontend/` is **not** a workspace member; it has its own install.

## Tech stack (short)

| Area     | Stack                                                                                  |
| -------- | -------------------------------------------------------------------------------------- |
| API      | Bun, Elysia, Kysely, SQLite, JWT                                                       |
| Web PWA  | Vite (vite-plus), React, TanStack Router/Query, Radix, Tailwind, Eden-style API client |
| Showcase | React + Vite + Tailwind                                                                |
| Mobile   | Expo / React Native (separate from Bun workspaces)                                     |

## How to run things

From repo root after `bun install`:

- **Backend:** `cd backend && cp .env.example .env` (set `JWT_SECRET_KEY`, paths), then `bun run dev`. OpenAPI at `/openapi`, health at `/health`.
- **Web app:** `cd web_application` and `VITE_API_URL=http://localhost:5000 vp dev --host` (or whatever URL the browser can reach).
- **Docker dev (API + web + hot reload):** `docker compose -f docker-compose.dev.yml up --build` — see root README for ports and env.

Production-style Docker: `docker-compose.prod.yml`; optional `API_URL=...` when building the web image for a public API base URL.

Do **not** ask the user to run commands you can run yourself in this environment; prefer verifying changes with tests, lint, or builds when appropriate.

**During development**, from the **repository root**, always run **`vp check`** after substantive edits. It runs format, lint, and typecheck across the vite-plus workspace (backend, web, showcase, frontend, etc.). Fix any reported issues before considering the task done.

## Conventions for agents

- **Match existing code**: naming, imports, formatting, and abstraction level in the files you touch.
- **Keep scope tight**: implement what was asked; avoid drive-by refactors, unrelated files, or extra documentation unless the user requested it.
- **Secrets**: never commit real `.env` values or API keys; use `.env.example` patterns only.
- **Cross-package changes**: API contract changes may require updates in `backend` and the web client (generated or hand-maintained types) — check how the web app imports the API package before assuming.

## Quality checks (when relevant)

- **Repo-wide (preferred for dev):** `vp check` at the **repository root** — same gate as the unified toolchain; run it when touching TypeScript/JavaScript in this monorepo.
- Backend: `cd backend && bun test` and/or `bun run lint`
- Web: `cd web_application` — see `package.json` for `lint` / build
- Showcase: `bun run --filter wealth-manager-website` scripts as in root README

CI uses GitHub Actions; align with existing workflows when adding scripts or paths.

## Where to read more

- [README.md](README.md) — Docker, env vars, quick start
- [backend/README.md](backend/README.md) — API package
- [web_application/README.md](web_application/README.md) — PWA
- [frontend/README.md](frontend/README.md) — Expo app
- [showcase_website/README.md](showcase_website/README.md) — marketing site
