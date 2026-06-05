import { runWealthAgent } from "../adk/runWealthAgent.js";
import type { AgentRun } from "./types.js";

/** Run the finance agent via Google ADK + OpenRouter. */
export async function runAgent(run: AgentRun, request: Request): Promise<void> {
  return runWealthAgent(run, request);
}
