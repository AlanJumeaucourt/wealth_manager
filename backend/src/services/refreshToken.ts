import { createHash, randomUUID } from "node:crypto";
import { db } from "../db/client.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newRefreshJti(): string {
  return randomUUID();
}

export async function storeRefreshToken(opts: {
  userId: number;
  jti: string;
  token: string;
  expiresAt: Date;
}): Promise<void> {
  const now = new Date().toISOString();
  await db()
    .insertInto("refresh_tokens")
    .values({
      user_id: opts.userId,
      jti: opts.jti,
      token_hash: hashToken(opts.token),
      expires_at: opts.expiresAt.toISOString(),
      revoked_at: null,
      created_at: now,
    })
    .execute();
}

export async function findValidRefreshToken(opts: {
  jti: string;
  token: string;
}): Promise<{ userId: number; id: number } | null> {
  const row = await db()
    .selectFrom("refresh_tokens")
    .select(["id", "user_id", "token_hash", "expires_at", "revoked_at"])
    .where("jti", "=", opts.jti)
    .executeTakeFirst();
  if (!row) return null;
  if (row.revoked_at != null) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  if (row.token_hash !== hashToken(opts.token)) return null;
  return { userId: row.user_id, id: row.id };
}

export async function revokeRefreshTokenByJti(jti: string): Promise<void> {
  await db()
    .updateTable("refresh_tokens")
    .set({ revoked_at: new Date().toISOString() })
    .where("jti", "=", jti)
    .where("revoked_at", "is", null)
    .execute();
}

export async function revokeAllRefreshTokensForUser(userId: number): Promise<void> {
  await db()
    .updateTable("refresh_tokens")
    .set({ revoked_at: new Date().toISOString() })
    .where("user_id", "=", userId)
    .where("revoked_at", "is", null)
    .execute();
}
