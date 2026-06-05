import {
  EventType,
  InMemoryRunner,
  isFinalResponse,
  stringifyContent,
  toStructuredEvents,
} from "@google/adk";
import type { Event } from "@google/adk";
import { createPartFromText } from "@google/genai";
import { config } from "../../config.js";
import { toUserFacingAgentError } from "../errors.js";
import type { Proposal } from "../proposals.js";
import { isRetryableLlmError, retryDelayMs, sleep } from "../retry.js";
import {
  abortAgentRun,
  getAgentRun,
  getRunAbortSignal,
  pushEvent,
  updateRun,
} from "../agent/runs.js";
import type { AgentPlanStep, AgentRun } from "../agent/types.js";
import { isListToolName, summarizeListToolResult } from "../tools/listToolDispatcher.js";
import { ensureAdkProvidersRegistered } from "./setup.js";
import { createWealthLlmAgent } from "./wealthAgent.js";

function defaultPlan(goal: string): AgentPlanStep[] {
  return [
    { id: "1", description: `Understand: ${goal.slice(0, 100)}`, done: false },
    { id: "2", description: "Read data with tools and respond or propose fixes", done: false },
  ];
}

function isMaxLlmCallsError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Max number of llm calls limit");
}

function isRunTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Agent run timed out");
}

function summarizeToolResponse(toolName: string, response: unknown): string {
  if (response && typeof response === "object" && "error" in response) {
    return `Error: ${String((response as { error: string }).error)}`;
  }
  if (response && typeof response === "object" && "summary" in response) {
    return String((response as { summary: string }).summary);
  }
  if (
    isListToolName(toolName) &&
    response &&
    typeof response === "object" &&
    "result" in response
  ) {
    return summarizeListToolResult(toolName, (response as { result: unknown }).result);
  }
  if (toolName === "find_data_quality_issues" && response && typeof response === "object") {
    const r = response as { issueCount?: number; truncated?: boolean };
    if (typeof r.issueCount === "number") {
      return `find_data_quality_issues: ${r.issueCount} issue(s)${r.truncated ? " (truncated)" : ""}`;
    }
  }
  try {
    const s = JSON.stringify(response);
    return s.length > 500 ? `${s.slice(0, 500)}…` : s;
  } catch {
    return `${toolName}: done`;
  }
}

async function consumeAgentStream(
  runner: InMemoryRunner,
  params: {
    userId: string;
    sessionId: string;
    goal: string;
    isContinuation: boolean;
    userIdNum: number;
    runId: string;
    userMessage?: string;
  },
): Promise<string | undefined> {
  let finalMessage: string | undefined;
  const userText =
    params.userMessage ??
    (params.isContinuation
      ? "Continue where you left off. Do not repeat tool calls you already made unless you need fresh data."
      : params.goal);

  for await (const event of runner.runAsync({
    userId: params.userId,
    sessionId: params.sessionId,
    newMessage: {
      role: "user",
      parts: [createPartFromText(userText)],
    },
    abortSignal: getRunAbortSignal(params.runId),
    runConfig: { maxLlmCalls: config.ai.maxSteps },
  })) {
    if (getAgentRun(params.runId, params.userIdNum)?.cancelled) {
      return undefined;
    }
    finalMessage = processAgentEvent(event, finalMessage);
  }
  return finalMessage;
}

function processAgentEvent(event: Event, priorFinal?: string): string | undefined {
  for (const structured of toStructuredEvents(event)) {
    if (structured.type === EventType.ERROR) {
      throw structured.error;
    }
    if (structured.type === EventType.FINISHED) {
      if (typeof structured.output === "string") {
        return structured.output;
      }
    }
  }
  if (isFinalResponse(event)) {
    const text = stringifyContent(event);
    if (text) return text;
  }
  const text = stringifyContent(event);
  return text || priorFinal;
}

function completeRun(run: AgentRun, finalMessage: string, proposals: Proposal[]): void {
  updateRun(run.id, {
    status: "completed",
    finalMessage,
    proposals,
  });
  pushEvent(run.id, { type: "run_completed", finalMessage });
}

export async function runWealthAgent(run: AgentRun, request: Request): Promise<void> {
  ensureAdkProvidersRegistered();

  const toolCtx = () => ({
    userId: run.userId,
    request,
    set: { status: 200 as number | string },
  });

  let proposals: Proposal[] = [...run.proposals];
  const proposalKeys = new Set(proposals.map((p) => JSON.stringify(p)));
  let dataQualityIssueCount = 0;

  const addProposals = (incoming: Proposal[]) => {
    for (const p of incoming) {
      const key = JSON.stringify(p);
      if (proposalKeys.has(key)) continue;
      proposalKeys.add(key);
      proposals.push(p);
      pushEvent(run.id, { type: "proposal_added", proposal: p });
    }
    updateRun(run.id, { proposals });
  };

  const userId = String(run.userId);
  const agent = createWealthLlmAgent({
    getListContext: toolCtx,
    onProposals: addProposals,
    onDataQualityScan: (count) => {
      dataQualityIssueCount = count;
    },
    onToolStart: (toolName, args) => {
      if (getAgentRun(run.id, run.userId)?.cancelled) return;
      pushEvent(run.id, { type: "tool_called", toolName, args });
      updateRun(run.id, { status: "executing" });
    },
    onToolEnd: (toolName, _args, response) => {
      if (getAgentRun(run.id, run.userId)?.cancelled) return;
      pushEvent(run.id, {
        type: "tool_result",
        toolName,
        summary: summarizeToolResponse(toolName, response),
      });
    },
  });

  const runner = new InMemoryRunner({ agent, appName: "wealth-manager" });
  const timeoutMs = config.ai.runTimeoutSec * 1000;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const plan = defaultPlan(run.goal);
    updateRun(run.id, { status: "executing", plan });
    pushEvent(run.id, { type: "plan_created", plan });

    await runner.sessionService.createSession({
      appName: "wealth-manager",
      userId,
      sessionId: run.id,
    });

    let finalMessage: string | undefined;
    let isContinuation = false;

    const runLoop = async (): Promise<void> => {
      for (let runAttempt = 0; runAttempt < config.ai.retryMaxAttempts; runAttempt++) {
        if (getAgentRun(run.id, run.userId)?.cancelled) return;

        try {
          finalMessage = await consumeAgentStream(runner, {
            userId,
            sessionId: run.id,
            goal: run.goal,
            isContinuation,
            userIdNum: run.userId,
            runId: run.id,
          });
          return;
        } catch (error) {
          if (getAgentRun(run.id, run.userId)?.cancelled) return;

          if (isMaxLlmCallsError(error)) {
            finalMessage =
              proposals.length > 0
                ? `Reached the ${config.ai.maxSteps}-step limit. Review ${proposals.length} proposal(s) below and apply any you agree with.`
                : `Reached the ${config.ai.maxSteps}-step limit. Try a narrower question (e.g. one account or fewer transactions).`;
            return;
          }

          if (!isRetryableLlmError(error) || runAttempt >= config.ai.retryMaxAttempts - 1) {
            throw error;
          }

          const delayMs = retryDelayMs(runAttempt);
          const waitSec = Math.max(1, Math.round(delayMs / 1000));
          pushEvent(run.id, {
            type: "reflection",
            message: `Rate-limited; waiting ${waitSec}s before continuing (${runAttempt + 1}/${config.ai.retryMaxAttempts})…`,
          });
          await sleep(delayMs);
          isContinuation = true;
        }
      }
    };

    await new Promise<void>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        abortAgentRun(run.id);
        reject(new Error(`Agent run timed out after ${config.ai.runTimeoutSec}s`));
      }, timeoutMs);

      void runLoop()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          if (timeoutId) clearTimeout(timeoutId);
        });
    });

    if (getAgentRun(run.id, run.userId)?.cancelled) return;

    if (
      proposals.length === 0 &&
      dataQualityIssueCount > 0 &&
      !getAgentRun(run.id, run.userId)?.cancelled
    ) {
      pushEvent(run.id, {
        type: "reflection",
        message: `Asking the model to propose fixes for ${dataQualityIssueCount} issue(s)…`,
      });
      const nudged = await consumeAgentStream(runner, {
        userId,
        sessionId: run.id,
        goal: run.goal,
        isContinuation: true,
        userIdNum: run.userId,
        runId: run.id,
        userMessage: `The scan found ${dataQualityIssueCount} issue(s). Invoke the propose_changes TOOL (not chat JSON) with up to 25 update_transaction items: transactionId, patch { category, subcategory }, reason. Use list_category_catalog for French names. Then summarize for the user.`,
      });
      if (nudged) finalMessage = nudged;
    }

    completeRun(run, finalMessage ?? "Done.", proposals);
  } catch (error) {
    if (getAgentRun(run.id, run.userId)?.cancelled) return;

    if (isMaxLlmCallsError(error)) {
      const message =
        proposals.length > 0
          ? `Reached the ${config.ai.maxSteps}-step limit. Review ${proposals.length} proposal(s) below.`
          : `Reached the ${config.ai.maxSteps}-step limit. Try a narrower question.`;
      completeRun(run, message, proposals);
      return;
    }

    if (isRunTimeoutError(error)) {
      const message =
        proposals.length > 0
          ? `Run timed out after ${config.ai.runTimeoutSec}s. Partial proposals are available below.`
          : `Run timed out after ${config.ai.runTimeoutSec}s. Try a simpler question.`;
      completeRun(run, message, proposals);
      return;
    }

    const message = toUserFacingAgentError(error);
    updateRun(run.id, { status: "failed", error: message, proposals });
    pushEvent(run.id, { type: "run_failed", error: message });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    try {
      await runner.sessionService.deleteSession({
        appName: "wealth-manager",
        userId,
        sessionId: run.id,
      });
    } catch {
      // session may already be gone
    }
  }
}
