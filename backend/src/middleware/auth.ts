import { Elysia } from "elysia";
import { SignJWT, jwtVerify } from "jose";
import { config } from "../config.js";

const secret = new TextEncoder().encode(config.jwt.secretKey);
type TokenType = "access" | "refresh";

export type AuthDerive = { userId: number | null };

export async function createAccessToken(
  userId: number,
  email: string,
  name: string,
): Promise<string> {
  return new SignJWT({ sub: String(userId), email, name, token_type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${config.jwt.accessTokenExpiresSec}s`)
    .sign(secret);
}

export async function createRefreshToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId), token_type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${config.jwt.refreshTokenExpiresSec}s`)
    .sign(secret);
}

function parseTokenUserId(sub: unknown): number {
  if (typeof sub !== "string" || sub.trim() === "") throw new Error("Invalid token");
  const userId = parseInt(sub, 10);
  if (!Number.isInteger(userId) || userId <= 0) throw new Error("Invalid token");
  return userId;
}

async function verifyToken(token: string, expectedType: TokenType): Promise<{ userId: number }> {
  const { payload } = await jwtVerify(token, secret);
  if (payload.token_type !== expectedType) throw new Error("Invalid token");
  return { userId: parseTokenUserId(payload.sub) };
}

export async function verifyAccessToken(token: string): Promise<{ userId: number }> {
  return verifyToken(token, "access");
}

export async function verifyRefreshToken(token: string): Promise<{ userId: number }> {
  return verifyToken(token, "refresh");
}

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

/** Derive userId from JWT (null if missing/invalid). Use requireAuth in guards for protected routes. */
export async function deriveAuth(request: Request): Promise<AuthDerive> {
  const pathname = new URL(request.url).pathname;
  if (pathname === "/health") return { userId: null };
  const token = getBearerToken(request);
  if (!token) return { userId: null };
  try {
    const { userId } = await verifyAccessToken(token);
    return { userId };
  } catch {
    return { userId: null };
  }
}

/** Call in beforeHandle on protected routes; throws if userId is null. */
export function requireAuth({ userId }: AuthDerive): void {
  if (userId == null) throw new Error("Unauthorized: missing or invalid token");
}

/** Elysia plugin that derives userId from JWT. Use once at app level to avoid repeating .derive() in every route. */
export const authDerivePlugin = new Elysia({ name: "auth-derive" }).derive(
  { as: "scoped" },
  async ({ request }) => await deriveAuth(request),
);

/** Returns 403 response if id !== userId. Use for self-access routes (e.g. users/:id). */
export function requireSelfAccess(
  userId: number,
  id: number,
  set: { status?: number | string },
  message = "Unauthorized, cannot access this user",
): { error: string } | void {
  if (id !== userId) {
    set.status = 403;
    return { error: message };
  }
}
