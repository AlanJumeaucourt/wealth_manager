import { db } from "../db/client.js";
import type { User } from "../types/index.js";
import { errorMessage, ConflictError, NotFoundError } from "../utils/error.js";

export async function createUser(name: string, email: string, passwordHash: string): Promise<User> {
  try {
    const row = await db()
      .insertInto("users")
      .values({
        name,
        email,
        password: passwordHash,
        preferred_currency: "EUR",
        last_login: null,
      })
      .returningAll()
      .executeTakeFirst();
    if (!row) {
      throw new ConflictError("A user with this email already exists.");
    }
    return rowToUser(row);
  } catch (e) {
    const msg = errorMessage(e);
    if (msg.includes("UNIQUE") && msg.includes("email")) {
      throw new ConflictError("A user with this email already exists.");
    }
    throw e;
  }
}

function rowToUser(row: {
  id: number;
  name: string;
  email: string;
  password: string;
  last_login: string | null | undefined;
  preferred_currency: string;
}): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    last_login: row.last_login ?? null,
    preferred_currency: row.preferred_currency,
  };
}

/** Uppercase ISO currency code for display amounts (`amount_preferred`, etc.). */
export async function getUserPreferredCurrency(userId: number): Promise<string> {
  const row = await db()
    .selectFrom("users")
    .select("preferred_currency")
    .where("id", "=", userId)
    .executeTakeFirst();
  return (row?.preferred_currency ?? "EUR").toUpperCase();
}

export async function getUserById(userId: number): Promise<User | null> {
  const row = await db()
    .selectFrom("users")
    .selectAll()
    .where("id", "=", userId)
    .executeTakeFirst();
  if (!row) return null;
  return rowToUser(row);
}

export async function getUserByEmail(email: string): Promise<(User & { password: string }) | null> {
  const row = await db()
    .selectFrom("users")
    .selectAll()
    .where("email", "=", email)
    .executeTakeFirst();
  if (!row) return null;
  return { ...rowToUser(row), password: row.password };
}

export async function updateUser(
  userId: number,
  updates: { name?: string; email?: string; password?: string; preferred_currency?: string },
): Promise<User> {
  const values: Record<string, string> = {};
  if (updates.name != null) values.name = updates.name;
  if (updates.email != null) values.email = updates.email;
  if (updates.password != null) values.password = updates.password;
  if (updates.preferred_currency != null) values.preferred_currency = updates.preferred_currency;
  if (Object.keys(values).length === 0) {
    const user = await getUserById(userId);
    if (!user) {
      throw new NotFoundError("Update user: user not found");
    }
    return user;
  }
  const row = await db()
    .updateTable("users")
    .set(values)
    .where("id", "=", userId)
    .returningAll()
    .executeTakeFirst();
  if (!row) {
    throw new NotFoundError("Update user: no rows updated (user may not exist)");
  }
  return rowToUser(row);
}

export async function updateLastLogin(userId: number, loginTime: Date): Promise<void> {
  await db()
    .updateTable("users")
    .set({ last_login: loginTime.toISOString() })
    .where("id", "=", userId)
    .execute();
}

export async function deleteUser(userId: number): Promise<void> {
  const result = await db().deleteFrom("users").where("id", "=", userId).executeTakeFirst();
  const deleted = Number(result.numDeletedRows);
  if (deleted === 0) {
    throw new NotFoundError("Delete user: no rows deleted (user may not exist)");
  }
}
