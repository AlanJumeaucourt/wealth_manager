/** Safe string conversion for logging and DB string columns; avoids `no-base-to-string` on `unknown`. */
export function stringifyUnknown(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return "[function]";
  return "";
}
