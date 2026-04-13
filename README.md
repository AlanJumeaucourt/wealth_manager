# 💰 WealthManager

<p align="center">
  <img src="frontend/assets/images/logo.png" alt="WealthManager Logo" width="200"/>
</p>

A comprehensive personal finance management platform available as a mobile app and web application, designed to help users take control of their financial lives with powerful features and an intuitive interface.

🌐 **[Try Web App](https://alanjumeaucourt.github.io/wealth_manager/app)** |
🎯 **[View Mobile App Showcase](https://alanjumeaucourt.github.io/wealth_manager)** |
🐳 **[Quick Start with Docker](#-docker-setup)**

## 🐳 Docker Setup

### Prerequisites

- Docker
- Docker Compose

### Development Environment

Starts the **Bun + Elysia** API and the **Vite (vite-plus)** web app with hot reload. Data lives in a named volume; the API runs migrations when the process starts.

```bash
docker compose -f docker-compose.dev.yml up --build
```

Copy `backend/.env.example` to `backend/.env` and set at least `JWT_SECRET_KEY` (and any overrides). The compose file may set `VITE_API_URL` for the web container—point it at the backend URL your browser can reach (often `http://localhost:5000` when testing from the host).

Services:

- **Backend:** http://localhost:5000 — OpenAPI at `/openapi`, health at `/health`
- **Web app:** http://localhost:5173

### Production Environment

```bash
docker compose -f docker-compose.prod.yml up --build
```

Or with a public API URL baked into the web build:

```bash
API_URL=https://api.example.com docker compose -f docker-compose.prod.yml up --build
```

- **Backend (host):** http://localhost:5001 (container listens on 5000)
- **Web app (host):** http://localhost:80

## Render Deployment

A Render Blueprint is included at `render.yaml` to deploy both services:

- `wealth-backend` as a Docker web service (Bun + Elysia API)
- `wealth-web-application` as a static site (Vite build output from `web_application/dist`)

### One-time setup

1. In Render, create a **Blueprint** service from this repository.
2. Let Render create both services from `render.yaml`.
3. Open the backend service URL (for example `https://wealth-backend.onrender.com`).
4. In the static site service, set `VITE_API_URL` to that backend URL.
5. Trigger a redeploy of the static site so the frontend is rebuilt with the API URL.

### Notes

- The backend uses a persistent disk mounted at `/app/data` and stores SQLite at `/app/data/wealth.db`.
- `JWT_SECRET_KEY` is generated automatically by Render from the blueprint.
- Backend health check path is `/health`.
- If your backend URL changes, update `VITE_API_URL` and redeploy the static site.

### Environment Variables

- **`API_URL`** — Public URL of the backend used when **building** the production web image (`VITE_API_URL`). Defaults to `/api` if unset (suitable when the app and API share an origin behind a reverse proxy).
- **`JWT_SECRET_KEY`** — JWT signing secret for the API (required in production; use a long random value).

## 🎯 Platform Overview

WealthManager is available in two formats, with a showcase website:

### 📱 Mobile Application (Coming Soon)

Our flagship mobile app built with **React Native** and **Expo**, perfect for on-the-go finance management.

Key features:

- 📊 Real-time wealth tracking and visualization
- 💳 Multi-account management with bank integration
- 📈 Investment portfolio tracking and analysis
- 💰 Smart budgeting and expense analytics
- 🔄 Intelligent transaction management

[View mobile app showcase](frontend/README.md)

### 🖥️ Web Application

A full-featured **React** PWA built with **Vite (vite-plus)**, **TanStack Router & Query**, **Radix UI**, and **Tailwind**—desktop-optimized with rich charts and keyboard-friendly workflows.

Features:

- 🖥️ Desktop-optimized interface
- 🚀 Real-time data synchronization
- 📊 Advanced data visualization
- ⌨️ Keyboard shortcuts support
- 🔄 Seamless backend integration (JWT, Eden-style client types from the API package)

[Web application details](web_application/README.md)

### 🌐 Showcase Website

A static marketing site for the mobile app, built with React + Vite + Tailwind and deployed under a GitHub Pages subpath.

[Showcase website](showcase_website/README.md)

## 🚀 Getting Started

### Prerequisites

- **[Bun](https://bun.sh/)** `1.1.33+` (repo root and workspaces use the `packageManager` field)
- **[vite-plus](https://voidzero.dev/)** (`vp`) — pulled in as a dev dependency; root `bun install` runs `prepare` → `vp config`

The **Expo mobile app** in `frontend/` is **not** a Bun workspace package; it uses its own install (`npm` or `bun` per that folder’s `package.json`).

### Quick Start

Monorepo layout: **`backend/`** (API package `wealth-backend-typescript`), **`web_application/`** (PWA), **`showcase_website/`** (marketing). Clone the repo, then from the **repository root**:

```bash
bun install
```

1. **Backend**

```bash
cd backend
cp .env.example .env   # set SQLITE_DB_PATH and JWT_SECRET_KEY
bun run migrate        # optional if you rely on migrate-on-start from index.ts
bun run dev
```

2. **Web application**

```bash
cd web_application
VITE_API_URL=http://localhost:5000 vp dev --host
```

3. **Mobile app** (standalone install)

```bash
cd frontend
npm install
npm run start
```

4. **Showcase website** (from repo root after `bun install`)

```bash
bun run --filter wealth-manager-website dev
```

## 📚 Documentation

- [Backend API (Bun + Elysia + Kysely)](backend/README.md)
- [Web application (React PWA)](web_application/README.md)
- [Mobile app (Expo)](frontend/README.md)
- [Showcase website](showcase_website/README.md)

## 🛠 Development

The project uses GitHub Actions for CI/CD with separate deployment pipelines for:

- Web application (`/app` on GitHub Pages)
- Showcase website (`/`)
- Mobile app (Expo / EAS)
