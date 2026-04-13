/** Request-scoped ref so error handler can set the reason and response log can include it */
export type ErrorMessageRef = { current: string | null };

export function logRequest({ request }: { request: Request }): void {
  const url = new URL(request.url);
  console.log(`${request.method} ${url.pathname}`);
}

/** Set LOG_JSON=1 for one JSON line per response (like Python's structured logger). */
const LOG_JSON = process.env.LOG_JSON === "1" || process.env.LOG_JSON === "true";

/**
 * Log every response explicitly (like Python backend): method, path, status, duration, reason.
 * For 4xx/5xx the reason is set by the error handler via _errorRef.
 * With LOG_JSON=1 outputs one JSON line per response for parsing/grep.
 */
export function logResponse({
  request,
  status,
  durationMs,
  reason,
  userId,
}: {
  request: Request;
  status: number;
  durationMs?: number;
  reason?: string | null;
  userId?: number | null;
}): void {
  const url = new URL(request.url);
  if (LOG_JSON) {
    const payload: Record<string, unknown> = {
      method: request.method,
      path: url.pathname,
      status,
      ...(durationMs != null && { duration_ms: durationMs }),
      ...(reason != null && reason !== "" && { reason }),
      ...(userId != null && { user_id: userId }),
    };
    const line = JSON.stringify(payload);
    if (status >= 500) console.error(line);
    else if (status >= 400) console.warn(line);
    else console.log(line);
    return;
  }
  const parts: string[] = [
    request.method,
    url.pathname,
    `status=${status}`,
    durationMs != null ? `duration=${durationMs}ms` : "",
  ].filter(Boolean);
  if (reason != null && reason !== "") parts.push(`reason=${JSON.stringify(reason)}`);
  if (userId != null) parts.push(`user_id=${userId}`);
  const line = parts.join(" ");
  if (status >= 500) {
    console.error(line);
  } else if (status >= 400) {
    console.warn(line);
  } else {
    console.log(line);
  }
}
