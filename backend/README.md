# Wealth Manager Backend (TypeScript)

API server for WealthManager: **Bun**, **Elysia**, **Kysely**, and **Bun’s native SQLite** via `kysely-bun-sqlite`. Request validation uses **Elysia TypeBox**; table and API shapes can be generated from `src/db/manifest.ts`.

## Stack

| Layer    | Choice                                                          |
| -------- | --------------------------------------------------------------- |
| Runtime  | [Bun](https://bun.sh/)                                          |
| HTTP     | [Elysia](https://elysiajs.com/) + CORS + OpenAPI plugin         |
| Database | SQLite (`bun:sqlite`) + [Kysely](https://kysely.dev/)           |
| Auth     | JWT ([jose](https://github.com/panva/jose)), Argon2id passwords |
| Docs     | `GET /openapi` (OpenAPI spec)                                   |

## Setup

1. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

2. Set **`SQLITE_DB_PATH`** and **`JWT_SECRET_KEY`** in `.env` (see `.env.example` for optional tuning).

3. Install and migrate:

   ```bash
   bun install
   bun run migrate
   ```

4. Start the server:

   ```bash
   bun run dev
   ```

The server listens on **`PORT`** (default **5000**). On normal startup, **`src/index.ts` runs migrations** before listening, so a separate `migrate` step is optional for local dev.

## Scripts

| Script                          | Purpose                                                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `bun run dev` / `bun run start` | Run the API once                                                                                                 |
| `bun run dev:watch`             | Run with `--watch` (used in some Docker setups)                                                                  |
| `bun run migrate`               | Run DB migrations only                                                                                           |
| `bun run codegen`               | Regenerate `schema.generated.ts`, TypeBox schemas, and `docs/schema-reference.sql` from **`src/db/manifest.ts`** |
| `bun run test`                  | `bun test`                                                                                                       |
| `bun run lint`                  | ESLint on `src`                                                                                                  |
| `bun run build:types`           | Emit `.d.ts` (run from repo root via `tsconfig.build.json`; used by the web app’s typecheck)                     |
| `bun run benchmark`             | Performance script                                                                                               |

## API

**Compatibility:** Routes and payloads match the legacy Flask API so existing clients keep working.

- **`GET /health`** — `{ "status": "ok" }` (no auth)
- **`GET /openapi`** — OpenAPI document

Resource routes are mounted at **top-level paths** (no global `/api` prefix), for example:

- `/users` — register, login, refresh, profile, `verify-token`
- `/banks`, `/accounts`, `/transactions`, `/assets`
- `/refund_groups`, `/refund_items`, `/potential_refunds`
- `/budgets`
- `/investments`, `/stocks`
- `/liabilities`, `/liability_payments`
- `/gocardless` — institutions, requisitions, accounts (see `STUBS.md` where behavior is placeholder)

Protected routes expect **`Authorization: Bearer <access_token>`**.

## Environment

See **`.env.example`**. Notable variables:

- **`SQLITE_DB_PATH`** — SQLite file path (required for real runs; test/dev behavior is relaxed in code)
- **`JWT_SECRET_KEY`** — In **production**, must be **≥ 32 characters** and not the dev default
- **`PORT`** — Listen port (default `5000`)
- **`JWT_ACCESS_TOKEN_EXPIRES`**, **`JWT_REFRESH_TOKEN_EXPIRES`** — Optional TTL overrides
- **`LOG_JSON`** — Set to `1` or `true` for JSON line logs

Placeholders in `.env.example` for **GoCardless** / **DEMO_MODE** are not wired everywhere in `src`; check routes and `STUBS.md` before relying on them.

## Docker

### Repo-level compose (full stack)

From the **repository root**:

- **Development:** `docker compose -f docker-compose.dev.yml up` — API + web app, volumes for `node_modules` and data.
- **Production:** `docker compose -f docker-compose.prod.yml up` — API on host port **5001**, static web on **80**.

### Backend-only compose

In **`backend/`**:

```bash
docker compose up --build
```

- Binds `./src` for hot reload; SQLite in volume at `/data/wealth.sqlite` (see `docker-compose.yml`).

## Security

- **Secrets:** Never commit `.env`. Production JWT secret must be strong and unique.
- **Passwords:** Argon2id via `Bun.password`; never returned in JSON.
- **Multi-tenancy:** `userId` from the JWT scopes all queries.
- **Validation:** TypeBox on inputs; Kysely uses bound parameters.
- **Errors:** Production 5xx bodies are generic; details go to logs.
- **CORS:** Defaults are permissive; tighten for production.
- **Hardening:** Rate limits on auth routes, HTTPS termination, and strict CORS are recommended for public deployments.
