import { Elysia, t } from "elysia";
import {
  authDerivePlugin,
  createAccessToken,
  createRefreshToken,
  getBearerToken,
  requireAuth,
  requireSelfAccess,
  revokeRefreshToken,
  revokeUserRefreshTokens,
  rotateRefreshToken,
} from "../middleware/auth.js";
import { invalidatePreferredCurrencyCache } from "../services/account.js";
import * as userService from "../services/user.js";
import {
  tIdParamSchema,
  tLoginSchema,
  tPreferredCurrencySchema,
  tRegisterSchema,
  tUpdateUserSchema,
} from "../schemas/typebox.js";
import { withIdParam } from "../utils/params.js";

function userToJson(u: {
  id: number;
  name: string;
  email: string;
  last_login?: string | null;
  preferred_currency: string;
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    last_login: u.last_login ?? null,
    preferred_currency: u.preferred_currency,
  };
}

export const usersRoutes = new Elysia({ prefix: "/users", tags: ["users"] })
  .use(authDerivePlugin)
  .post(
    "/register",
    async ({ body, set }) => {
      const { name, email, password } = body;
      const hash = await Bun.password.hash(password, { algorithm: "argon2id" });
      const user = await userService.createUser(name, email, hash);
      set.status = 201;
      return userToJson(user);
    },
    { body: tRegisterSchema, detail: { summary: "Register user" } },
  )
  .post(
    "/login",
    async ({ body, set }) => {
      const { email, password } = body;
      const user = await userService.getUserByEmail(email);
      if (!user) {
        set.status = 401;
        return { msg: "Invalid credentials", error: "authentication_failed" };
      }
      const ok = await Bun.password.verify(password, user.password);
      if (!ok) {
        set.status = 401;
        return { msg: "Invalid credentials", error: "authentication_failed" };
      }
      await userService.updateLastLogin(user.id, new Date());
      const access_token = await createAccessToken(user.id, user.email, user.name);
      const refresh_token = await createRefreshToken(user.id);
      return {
        access_token,
        refresh_token,
        user: userToJson(user),
        token_type: "bearer",
      };
    },
    { body: tLoginSchema, detail: { summary: "Login" } },
  )
  .post("/refresh", async ({ request, set }) => {
    const token = getBearerToken(request);
    if (!token) {
      set.status = 401;
      return { error: "Missing refresh token" };
    }
    try {
      const { userId, refreshToken } = await rotateRefreshToken(token);
      const user = await userService.getUserById(userId);
      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }
      const access_token = await createAccessToken(user.id, user.email, user.name);
      return {
        access_token,
        refresh_token: refreshToken,
        user: userToJson(user),
      };
    } catch {
      set.status = 401;
      return { error: "Token refresh failed" };
    }
  })
  .post("/logout", async ({ request, userId, set }) => {
    const token = getBearerToken(request);
    // Prefer revoking the presented refresh token; also accept access auth and wipe all.
    if (token) {
      // Try as refresh first (clients send refresh on logout if available).
      await revokeRefreshToken(token);
    }
    if (userId != null) {
      await revokeUserRefreshTokens(userId);
    }
    set.status = 204;
    return "";
  })
  .get("/verify-token", async ({ userId }) => {
    requireAuth({ userId });
    await userService.updateLastLogin(userId!, new Date());
    return { message: "Token is valid" };
  })
  .get("/", async ({ userId, set }) => {
    requireAuth({ userId });
    const user = await userService.getUserById(userId!);
    if (!user) {
      set.status = 404;
      return "";
    }
    return userToJson(user);
  })
  // Static paths MUST be registered before /:id so they are not shadowed.
  .put(
    "/preferred_currency",
    async ({ body, userId, set }) => {
      requireAuth({ userId });
      const preferred_currency = body.preferred_currency.toUpperCase();
      const supported = await userService.getUserTransactionCurrencies(userId!);
      if (!supported.includes(preferred_currency)) {
        set.status = 400;
        return { error: "Unsupported preferred_currency", supported };
      }
      const user = await userService.updateUser(userId!, { preferred_currency });
      invalidatePreferredCurrencyCache(userId!);
      return userToJson(user);
    },
    { body: tPreferredCurrencySchema },
  )
  .get(
    "/preferred_currency/options",
    async ({ userId }) => {
      requireAuth({ userId });
      const currencies = await userService.getUserTransactionCurrencies(userId!);
      return { currencies };
    },
    {
      response: {
        200: t.Object({
          currencies: t.Array(t.String()),
        }),
      },
      detail: { summary: "List unique currencies used by the user's transactions" },
    },
  )
  .get(
    "/:id",
    ({ params, userId, set }) =>
      withIdParam({ params, userId, set }, async (id) => {
        requireSelfAccess(userId!, id, set);
        const user = await userService.getUserById(id);
        if (!user) {
          set.status = 404;
          return "";
        }
        return userToJson(user);
      }),
    { params: tIdParamSchema },
  )
  .put(
    "/:id",
    ({ params, body, userId, set }) =>
      withIdParam({ params, userId, set }, async (id) => {
        requireSelfAccess(userId!, id, set, "Unauthorized, cannot update this user");
        const hasName = body.name != null && body.name !== "";
        const hasEmail = body.email != null && body.email !== "";
        const hasPassword = body.password != null && body.password !== "";
        if (!hasName && !hasEmail && !hasPassword) {
          set.status = 400;
          return { error: "At least one field required (name, email, or password)" };
        }
        const updates: { name?: string; email?: string; password?: string } = {};
        if (hasName) updates.name = body.name!;
        if (hasEmail) updates.email = body.email!;
        if (hasPassword) {
          updates.password = await Bun.password.hash(body.password!, { algorithm: "argon2id" });
          await revokeUserRefreshTokens(id);
        }
        const user = await userService.updateUser(id, updates);
        return userToJson(user);
      }),
    { params: tIdParamSchema, body: tUpdateUserSchema },
  )
  .delete(
    "/:id",
    ({ params, userId, set }) =>
      withIdParam({ params, userId, set }, async (id) => {
        requireSelfAccess(userId!, id, set, "Unauthorized");
        await revokeUserRefreshTokens(id);
        await userService.deleteUser(id);
        set.status = 204;
        return "";
      }),
    { params: tIdParamSchema },
  )
  .delete("/", async ({ userId, set }) => {
    requireAuth({ userId });
    await revokeUserRefreshTokens(userId!);
    await userService.deleteUser(userId!);
    set.status = 204;
    return "";
  });
