import { API_URL } from "./queryKeys";

let refreshInFlight: Promise<boolean> | null = null;

/** Clears auth storage and sends the user to the landing/login page. */
export function clearSessionAndRedirect(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  localStorage.removeItem("lastUserFetch");
  localStorage.removeItem("selectedTeam");
  localStorage.removeItem("dateRange");
  sessionStorage.clear();
  window.location.href = "/";
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Login/register 401 responses must not trigger refresh or forced logout. */
function shouldAttemptRefreshForUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    if (path.endsWith("/users/login") || path.endsWith("/users/register")) return false;
    return true;
  } catch {
    return true;
  }
}

async function refreshAccessTokenOnce(): Promise<boolean> {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return false;

  const res = await fetch(`${API_URL}/users/refresh`, {
    method: "POST",
    headers: { Authorization: `Bearer ${refresh}` },
  });

  if (!res.ok) return false;

  const data = (await res.json()) as {
    access_token: string;
    user?: { id: number; email: string; name: string };
  };
  localStorage.setItem("access_token", data.access_token);
  if (data.user) {
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("lastUserFetch", Date.now().toString());
  }
  return true;
}

/** Serialized refresh so concurrent 401s share one refresh call. */
export function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessTokenOnce().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Adds the access token, handles 401 by refreshing once, then retries.
 * Use for all authenticated API calls so rotation and session expiry behave consistently.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = resolveRequestUrl(input);
  const headers = new Headers(init?.headers);
  const access = localStorage.getItem("access_token");
  if (access) headers.set("Authorization", `Bearer ${access}`);

  const response = await fetch(input, { ...init, headers });

  if (response.status !== 401 || !shouldAttemptRefreshForUrl(url)) {
    return response;
  }

  const ok = await refreshAccessToken();
  if (!ok) {
    clearSessionAndRedirect();
    return response;
  }

  const next = localStorage.getItem("access_token");
  if (next) headers.set("Authorization", `Bearer ${next}`);
  return fetch(input, { ...init, headers });
}
