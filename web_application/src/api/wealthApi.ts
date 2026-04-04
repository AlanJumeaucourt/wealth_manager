import { treaty, type Treaty } from "@elysiajs/eden";
import type { App } from "wealth-backend-typescript/app";
import { API_URL } from "./queryKeys";

/**
 * Eden Treaty client for the Wealth API ([Elysia Eden](https://elysiajs.com/eden/treaty/overview.html)).
 * Backend `App` comes from emitted declarations (`bun --cwd ../backend run build:types`).
 */
const wealthApiTreaty = treaty(API_URL, {
  fetcher: (url, options) => {
    const token = localStorage.getItem("access_token");
    const headers = new Headers(options?.headers as HeadersInit | undefined);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(url, {
      ...options,
      headers,
    });
  },
});

/** Cast for API typing; composed `App` can exceed Eden's `Treaty.Create` generic constraint (TS2344). */
// @ts-expect-error TS2344 — Elysia instance type depth vs `Treaty.Create<App>`
export const wealthApi = wealthApiTreaty as unknown as Treaty.Create<App>;
