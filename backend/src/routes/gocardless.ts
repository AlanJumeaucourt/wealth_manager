import { Elysia } from "elysia";
import { authDerivePlugin, requireAuth } from "../middleware/auth.js";

const STUB_ROUTES: { method: "get" | "post"; path: string }[] = [
  { method: "get", path: "/institutions" },
  { method: "get", path: "/institutions/:institution_id" },
  { method: "post", path: "/agreements/enduser" },
  { method: "post", path: "/requisitions" },
  { method: "get", path: "/requisitions/:id" },
  { method: "get", path: "/requisitions/by-reference/:reference" },
  { method: "get", path: "/accounts/:id/details" },
  { method: "get", path: "/accounts/:id/balances" },
  { method: "get", path: "/accounts/:id/transactions" },
  { method: "get", path: "/accounts/:id" },
  { method: "post", path: "/link-accounts" },
  { method: "post", path: "/token/new" },
  { method: "get", path: "/accounts" },
];

function createStubHandler() {
  return async ({ userId, set }: { userId: number | null; set: { status?: number | string } }) => {
    requireAuth({ userId });
    set.status = 501;
    return {
      error: "GoCardless integration is not implemented",
      code: "NOT_IMPLEMENTED",
    };
  };
}

export const gocardlessRoutes = STUB_ROUTES.reduce(
  (app, route) => app[route.method](route.path, createStubHandler()),
  new Elysia({ prefix: "/gocardless", tags: ["accounts"] }).use(authDerivePlugin),
);
