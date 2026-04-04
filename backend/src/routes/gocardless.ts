import { Elysia } from "elysia";
import { authDerivePlugin, requireAuth } from "../middleware/auth.js";

const STUB_ROUTES: { method: "get" | "post"; path: string; status?: number; body: unknown }[] = [
  { method: "get", path: "/institutions", body: [] },
  { method: "get", path: "/institutions/:institution_id", body: {} },
  { method: "post", path: "/agreements/enduser", status: 201, body: {} },
  { method: "post", path: "/requisitions", status: 201, body: {} },
  { method: "get", path: "/requisitions/:id", body: {} },
  { method: "get", path: "/requisitions/by-reference/:reference", body: {} },
  { method: "get", path: "/accounts/:id/details", body: {} },
  { method: "get", path: "/accounts/:id/balances", body: {} },
  { method: "get", path: "/accounts/:id/transactions", body: [] },
  { method: "get", path: "/accounts/:id", body: [] },
  { method: "post", path: "/link-accounts", status: 201, body: {} },
  { method: "post", path: "/token/new", status: 201, body: {} },
  { method: "get", path: "/accounts", body: [] },
];

function createStubHandler(route: (typeof STUB_ROUTES)[0]) {
  return async ({ userId, set }: { userId: number | null; set: { status?: number | string } }) => {
    requireAuth({ userId });
    if (route.status) set.status = route.status;
    return route.body;
  };
}

export const gocardlessRoutes = STUB_ROUTES.reduce(
  (app, route) => app[route.method](route.path, createStubHandler(route)),
  new Elysia({ prefix: "/gocardless", tags: ["accounts"] }).use(authDerivePlugin),
);
