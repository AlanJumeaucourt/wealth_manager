import { treaty, type Treaty } from "@elysiajs/eden";
import type { App } from "wealth-backend-typescript/app";
import { authFetch } from "./authFetch";
import { API_URL } from "./queryKeys";

/**
 * Eden Treaty client for the Wealth API ([Elysia Eden](https://elysiajs.com/eden/treaty/overview.html)).
 * Backend `App` comes from emitted declarations (`bun --cwd ../backend run build:types`).
 */
const wealthApiTreaty = treaty(API_URL, {
  /** Required when `API_URL` is path-relative (`/api`); otherwise Eden prepends `https://` and `/api` becomes `https://api`. */
  keepDomain: true,
  fetcher: (url, options) =>
    authFetch(url, {
      ...options,
      headers: options?.headers as HeadersInit | undefined,
    }),
});

/** Cast for API typing; composed `App` can exceed Eden's `Treaty.Create` generic constraint (TS2344). */
// @ts-ignore TS2344 — Elysia instance depth vs `Treaty.Create<App>` (treaty generic constraint)
export const wealthApi = wealthApiTreaty as unknown as Treaty.Create<App>;
