# WealthManager Showcase Website

Marketing and feature overview for the mobile app: **React 18**, **TypeScript**, **Tailwind CSS**, **Lucide** icons, bundled with **[vite-plus](https://voidzero.dev/)** (Vite-compatible CLI: **`vp`**).

Hosted on **Render** as a static site.

The app currently builds with `vite.config.ts` → `base: "/wealth_manager/"`.
If you host this showcase at the domain root on Render, set `base: "/"` before building.

## Prerequisites

- **Bun** `1.1.33+` (see repo root `packageManager`)

## Quick start

From the **repository root** (recommended—workspace install):

```bash
bun install
bun run --filter wealth-manager-website dev
```

Or from this directory:

```bash
bun install
bun run dev
```

Dev server URL (typical): **http://localhost:5173/wealth_manager/** — paths are relative to the configured `base`.

## Render deployment

This package should be deployed as a **Static Site** on Render.

Example settings:

- **Root Directory:** `showcase_website`
- **Build Command:** `bun install && bun run build`
- **Publish Directory:** `dist`

If you keep `base: "/wealth_manager/"`, the app is expected to be served under `/wealth_manager/`.
For root-domain hosting (for example `https://your-site.onrender.com/`), switch to `base: "/"`.

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `bun run dev`     | `vp dev` — local dev server          |
| `bun run build`   | `tsc && vp build` — production build |
| `bun run preview` | `vp preview` — preview the build     |
| `bun run lint`    | ESLint                               |

## Tech stack

- React 18 + TypeScript
- Vite via **vite-plus** (`vite` → `@voidzero-dev/vite-plus-core`)
- Tailwind CSS v3
- `@vitejs/plugin-react`

## Related

- [Root README](../README.md) — full monorepo and Docker
- [Web application](../web_application/README.md) — full PWA client app
