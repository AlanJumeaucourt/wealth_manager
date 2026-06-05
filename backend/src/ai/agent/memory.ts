import { config } from "../../config.js";
import type { MemoryEntry } from "./types.js";

export function truncateJson(value: unknown, maxChars: number): string {
  const raw = JSON.stringify(value);
  if (raw.length <= maxChars) return raw;
  return `${raw.slice(0, maxChars)}…[truncated]`;
}

export function appendMemory(memory: MemoryEntry[], entry: Omit<MemoryEntry, "at">): MemoryEntry[] {
  const next = [...memory, { ...entry, at: new Date().toISOString() }];
  const maxEntries = 30;
  return next.slice(-maxEntries);
}

export function buildMemoryContext(memory: MemoryEntry[]): string {
  if (memory.length === 0) return "";
  return memory.map((m) => `- [${m.at}] ${m.toolName}: ${m.summary}`).join("\n");
}

export function summarizeToolPayload(toolName: string, payload: unknown): string {
  const max = config.ai.maxToolResultChars;
  if (payload && typeof payload === "object" && "error" in payload) {
    return `Error: ${String((payload as { error: string }).error)}`;
  }
  if (payload && typeof payload === "object" && "items" in payload) {
    const p = payload as { items: unknown[]; total?: number };
    return `${p.items.length} items (total ${p.total ?? p.items.length})`;
  }
  if (payload && typeof payload === "object" && "issues" in payload) {
    const p = payload as { issues: unknown[] };
    return `${p.issues.length} data quality issues`;
  }
  if (payload && typeof payload === "object" && "proposals" in payload) {
    const p = payload as { proposals: unknown[] };
    return `${p.proposals.length} proposals validated`;
  }
  return truncateJson(payload, Math.min(max, 2000));
}
