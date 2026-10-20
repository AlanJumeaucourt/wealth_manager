import { Elysia } from "elysia";

const MIN_BYTES = 1024;

function wantsGzip(acceptEncoding: string | null): boolean {
  if (!acceptEncoding) return false;
  return acceptEncoding.split(",").some((part) => part.trim().toLowerCase().startsWith("gzip"));
}

function toBytes(response: unknown): Uint8Array | null {
  if (response == null) return null;
  if (response instanceof Response || response instanceof ReadableStream) return null;
  if (typeof response === "bigint") return null;
  if (typeof response === "string") return new TextEncoder().encode(response);
  if (response instanceof ArrayBuffer) return new Uint8Array(response);
  if (ArrayBuffer.isView(response)) {
    return new Uint8Array(response.buffer, response.byteOffset, response.byteLength);
  }
  if (typeof response === "object") {
    return new TextEncoder().encode(JSON.stringify(response));
  }
  return null;
}

/**
 * Gzip JSON responses when the client accepts it.
 *
 * Must return a `Response` (not a bare `Uint8Array`): returning bytes from
 * `onAfterHandle` re-runs TypeBox response schemas and yields 422 on list routes.
 */
export const compressPlugin = new Elysia({ name: "compress" }).onAfterHandle(
  { as: "global" },
  ({ response, request, set }): unknown => {
    const accept = request.headers.get("accept-encoding");
    if (!wantsGzip(accept)) return response;

    const headers = { ...set.headers } as Record<string, string | number | undefined>;
    if (headers["content-encoding"] || headers["Content-Encoding"]) return response;

    const bytes = toBytes(response);
    if (bytes == null || bytes.byteLength < MIN_BYTES) return response;

    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const compressed = Bun.gzipSync(copy);

    const contentType =
      typeof response === "object" && response !== null && !(response instanceof ArrayBuffer)
        ? "application/json;charset=utf-8"
        : String(headers["content-type"] ?? headers["Content-Type"] ?? "application/octet-stream");

    const outHeaders = new Headers();
    for (const [key, value] of Object.entries(headers)) {
      if (value == null) continue;
      const lower = key.toLowerCase();
      if (lower === "content-length" || lower === "content-encoding") continue;
      outHeaders.set(key, String(value));
    }
    outHeaders.set("content-encoding", "gzip");
    outHeaders.set("vary", "accept-encoding");
    outHeaders.set("content-type", contentType);

    const status = typeof set.status === "number" ? set.status : 200;
    return new Response(compressed, { status, headers: outHeaders });
  },
);
