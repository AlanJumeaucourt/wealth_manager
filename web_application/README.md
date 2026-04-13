# WealthManager Web Application

Desktop-first **Progressive Web App** for WealthManager: **React 18**, **TanStack Router** (file-based), **TanStack Query**, **Radix UI**, **Tailwind**, **Zustand**, and charts (**Recharts**, **Nivo**, **Tremor**). Built with **[vite-plus](https://voidzero.dev/)** — dev/build commands use the **`vp`** CLI.

The UI talks to the **Bun + Elysia** backend using **`@elysiajs/eden`** and shared types from the workspace package **`wealth-backend-typescript`**.

## Prerequisites

- **Bun** `1.1.33+` (see repo root `packageManager`)
- Backend running or reachable (see [backend/README.md](../backend/README.md))

## Install & run

From the **repository root**:

```bash
bun install
cd web_application
VITE_API_URL=http://localhost:5000 vp dev --host
```

**`VITE_API_URL` is required** — the app throws at startup if it is missing (`src/api/queryKeys.ts`). Point it at your API origin (no trailing path segment for the base URL used by the client).

### Typecheck

`typecheck` depends on backend declaration emit:

```bash
bun run typecheck   # runs pretypecheck → backend build:types, then tsc
```

## Production build

```bash
VITE_API_URL=https://api.example.com vp build
vp preview
```

Docker production builds pass **`VITE_API_URL`** as a build arg (see `Dockerfile.prod` and root `docker-compose.prod.yml`).

## Dev proxy (Docker / unified origin)

`vite.config.ts` proxies **`/api`** → `http://backend:5000/` and strips the `/api` prefix so the Vite dev container can call the compose service name **`backend`**. When developing **without** Docker, prefer a direct **`VITE_API_URL`** to `http://localhost:5000` unless you add a matching local proxy.

## PWA

**`vite-plugin-pwa`** registers a service worker (auto-update), caches API routes (network-first) and images. Manifest metadata (name, icons, theme) is defined in `vite.config.ts`.

## Scripts

| Script              | Description             |
| ------------------- | ----------------------- |
| `bun run dev`       | `vp dev`                |
| `bun run build`     | `vp build`              |
| `bun run preview`   | `vp preview`            |
| `bun run lint`      | ESLint on `src`         |
| `bun run typecheck` | Backend types + `tsc`   |
| `bun run knip`      | Unused dependency check |

## Project layout

- **`src/routes/`** — TanStack Router file routes
- **`src/api/`** — Query keys, Eden client usage, API helpers
- **`src/components/`** — UI building blocks
- Path alias **`@/`** → **`src/`**

## Related

- [Backend README](../backend/README.md) — auth, OpenAPI at `/openapi`, routes
- [Root README](../README.md) — Docker and monorepo overview
