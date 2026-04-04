import { Elysia } from "elysia";
import {
  authDerivePlugin,
  createAccessToken,
  createRefreshToken,
  getBearerToken,
  requireAuth,
  requireSelfAccess,
  verifyRefreshToken,
} from "../middleware/auth.js";
import { invalidatePreferredCurrencyCache } from "../services/account.js";
import * as userService from "../services/user.js";
import { ConflictError } from "../utils/error.js";
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
      try {
        const user = await userService.createUser(name, email, hash);
        set.status = 201;
        return userToJson(user);
      } catch (e) {
        if (e instanceof ConflictError) {
          set.status = 422;
          return { error: e.message };
        }
        throw e;
      }
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
        user: { id: user.id, email: user.email, name: user.name },
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
      const { userId } = await verifyRefreshToken(token);
      const user = await userService.getUserById(userId);
      if (!user) {
        set.status = 404;
        return { error: "User not found" };
      }
      const access_token = await createAccessToken(user.id, user.email, user.name);
      return {
        access_token,
        user: { id: user.id, email: user.email, name: user.name },
      };
    } catch {
      set.status = 401;
      return { error: "Token refresh failed" };
    }
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
  .get(
    "/:id",
    ({ params, userId, set }) =>
      withIdParam({ params, userId, set }, async (id) => {
        const resp = requireSelfAccess(userId!, id, set);
        if (resp) return resp;
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
        const resp = requireSelfAccess(userId!, id, set, "Unauthorized, cannot update this user");
        if (resp) return resp;
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
        }
        const user = await userService.updateUser(id, updates);
        return userToJson(user);
      }),
    { params: tIdParamSchema, body: tUpdateUserSchema },
  )
  .put(
    "/preferred_currency",
    async ({ body, userId, set }) => {
      requireAuth({ userId });
      const preferred_currency = body.preferred_currency.toUpperCase();
      if (!["EUR", "RON"].includes(preferred_currency)) {
        set.status = 400;
        return { error: "Unsupported preferred_currency", supported: ["EUR", "RON"] };
      }
      const user = await userService.updateUser(userId!, { preferred_currency });
      invalidatePreferredCurrencyCache(userId!);
      return userToJson(user);
    },
    { body: tPreferredCurrencySchema },
  )
  .delete(
    "/:id",
    ({ params, userId, set }) =>
      withIdParam({ params, userId, set }, async (id) => {
        const resp = requireSelfAccess(userId!, id, set, "Unauthorized");
        if (resp) return resp;
        await userService.deleteUser(id);
        set.status = 204;
        return "";
      }),
    { params: tIdParamSchema },
  )
  .delete("/", async ({ userId, set }) => {
    requireAuth({ userId });
    await userService.deleteUser(userId!);
    set.status = 204;
    return "";
  });
