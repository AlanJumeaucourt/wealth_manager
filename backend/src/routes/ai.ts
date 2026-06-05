import { Elysia, t } from "elysia";
import { runAgent } from "../ai/agent/runtime.js";
import {
  cancelAgentRun,
  createAgentRun,
  getAgentRun,
  pruneExpiredRuns,
  subscribeRunEvents,
  toSnapshot,
} from "../ai/agent/runs.js";
import type { AgentEvent } from "../ai/agent/types.js";
import { AiConfigurationError, assertAiConfigured } from "../ai/errors.js";
import { authDerivePlugin, requireAuth } from "../middleware/auth.js";

const tStartRunBody = t.Object({
  message: t.String({ minLength: 1 }),
  conversationId: t.Optional(t.String()),
});

function sseResponse(runId: string, userId: number, initialEvents: AgentEvent[]): Response {
  const encoder = new TextEncoder();
  let unsub: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: AgentEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      for (const event of initialEvents) {
        send(event);
      }

      const current = getAgentRun(runId, userId);
      if (
        current &&
        (current.status === "completed" ||
          current.status === "failed" ||
          current.status === "cancelled")
      ) {
        closed = true;
        controller.close();
        return;
      }

      unsub = subscribeRunEvents(runId, (event) => {
        send(event);
        const run = getAgentRun(runId, userId);
        if (
          run &&
          (run.status === "completed" || run.status === "failed" || run.status === "cancelled")
        ) {
          closed = true;
          unsub?.();
          controller.close();
        }
      });
    },
    cancel() {
      closed = true;
      unsub?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export const aiRoutes = new Elysia({ prefix: "/ai", tags: ["ai"] })
  .use(authDerivePlugin)
  .post(
    "/runs",
    ({ body, userId, set }) => {
      requireAuth({ userId });
      try {
        assertAiConfigured();
      } catch (error) {
        if (error instanceof AiConfigurationError) {
          set.status = 503;
          return { error: error.message };
        }
        throw error;
      }
      pruneExpiredRuns();
      const goal = (body as { message: string }).message;
      const run = createAgentRun(userId!, goal);
      const request = new Request("http://agent.local/");
      void runAgent(run, request);
      return { runId: run.id };
    },
    {
      body: tStartRunBody,
      detail: { summary: "Start AI agent run" },
    },
  )
  .get(
    "/runs/:id",
    ({ params, userId, set }) => {
      requireAuth({ userId });
      const run = getAgentRun(params.id, userId!);
      if (!run) {
        set.status = 404;
        return { error: "Run not found" };
      }
      return toSnapshot(run);
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  .get("/runs/:id/events", ({ params, userId, set }) => {
    requireAuth({ userId });
    const run = getAgentRun(params.id, userId!);
    if (!run) {
      set.status = 404;
      return { error: "Run not found" };
    }
    return sseResponse(params.id, userId!, run.events);
  })
  .post(
    "/runs/:id/cancel",
    ({ params, userId, set }) => {
      requireAuth({ userId });
      const ok = cancelAgentRun(params.id, userId!);
      if (!ok) {
        set.status = 404;
        return { error: "Run not found" };
      }
      return { ok: true };
    },
    {
      params: t.Object({ id: t.String() }),
    },
  );
