import { clearSessionAndRedirect } from "@/api/authFetch";

/** Login/register failures use 401 but must not wipe the session. */
function isCredentialFailure(error: Record<string, unknown>): boolean {
  if (error.error === "authentication_failed") return true;
  const msg =
    typeof error.msg === "string" ? error.msg : typeof error.error === "string" ? error.error : "";
  return msg.includes("Invalid credentials");
}

/**
 * Detect session/auth failures and clear storage + redirect to login.
 * Backend uses `Unauthorized: missing or invalid token` for expired/invalid JWTs, not `token_expired`.
 */
export function handleTokenExpiration(error: unknown, status?: number): boolean {
  const o = error && typeof error === "object" ? (error as Record<string, unknown>) : null;

  if (o?.error === "token_expired" || o?.msg === "Token has expired") {
    clearSessionAndRedirect();
    return true;
  }

  if (status === 401 && o && !isCredentialFailure(o)) {
    clearSessionAndRedirect();
    return true;
  }

  if (status === 401 && !o) {
    clearSessionAndRedirect();
    return true;
  }

  return false;
}
