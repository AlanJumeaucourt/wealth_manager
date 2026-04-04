# Stub / not-yet-implemented endpoints

Endpoints that exist but return empty data or do not persist changes. Fix these when you need the feature.

## Investments (`/investments`)

- **GET /portfolio/risk-metrics** – returns `{}`. Frontend calls this; consider returning a minimal shape (e.g. `{ volatility: null, sharpe_ratio: null }`) or implementing.
- **GET /portfolio/analysis** – returns `{}`
- **GET /portfolio/attribution** – returns `{}`
- **GET /portfolio/dividend-analysis** – returns `{}`
- **GET /portfolio/correlation** – returns `{}`
- **GET /portfolio/rebalancing** – returns `{}`
- **GET /portfolio/tax-analysis** – returns `{}`
- **GET /portfolio/benchmarks** – returns `{}`

## Stocks (`/stocks`)

- **POST /:symbol/custom-prices** – returns `201` and `{}` but does **not** insert into `custom_prices`. Table exists; handler needs to parse body and insert.
- **PUT /:symbol/custom-prices/:date** – returns `{}` but does **not** update. Handler needs to update by symbol + date + user_id.
- **DELETE /:symbol/custom-prices/:date** and **DELETE /:symbol/custom-prices/batch** – return 204 but may not delete; verify.

## GoCardless (`/gocardless`)

All routes return `[]` or `{}` and do not call any external API or DB. Entire prefix is a stub until GoCardless is integrated:

- GET /institutions, GET /institutions/:id
- POST /agreements/enduser, POST /requisitions, GET /requisitions/:id, GET /requisitions/by-reference/:reference
- GET /accounts/:id/details, GET /accounts/:id/balances, GET /accounts/:id/transactions, GET /accounts/:id, GET /accounts
- POST /link-accounts, POST /token/new

## Liability payments (`/liability_payments`)

- **POST /record** – 201, returns `{}`; does not persist.
- **POST /** – 201, returns `{}`; does not persist.
- **GET /:id** – returns `{}`; does not load from DB.
- **PUT /:id** – returns `{}`; does not update.
- **DELETE /:id** – 204; confirm it deletes in DB.

Only **GET /liability/:liability_id** and **GET /** (list) use the DB; list returns empty items.

## Kysely transactions

Use the correct API so the transaction actually runs:

- `db.transaction().execute(async (trx) => { ... })` ✅
- `db.transaction(async (trx) => { ... })` ❌ (returns TransactionBuilder; awaiting it throws)

All current transaction usages in `src/services/investment.ts` have been fixed to use `.execute()`.
