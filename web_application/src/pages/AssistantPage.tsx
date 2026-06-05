import {
  streamAgentRunEvents,
  useAgentRun,
  useCancelAgentRun,
  useStartAgentRun,
} from "@/api/assistant";
import { AgentActivityTimeline } from "@/components/assistant/AgentActivityTimeline";
import { AssistantMarkdown } from "@/components/assistant/AssistantMarkdown";
import { ProposalsSheet } from "@/components/assistant/ProposalsSheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatAssistantErrorMessage, mergeAgentEvents } from "@/lib/agentEvents";
import { proposalStableKey } from "@/lib/proposalKey";
import type { AgentEvent, Proposal } from "@/types/assistant";
import { useEffect, useMemo, useRef, useState } from "react";

const SUGGESTED_PROMPTS = [
  "Find miscategorized expenses",
  "Transactions missing subcategory",
  "Accounts with placeholder names",
  "How much did I spend on groceries this month?",
];

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

export function AssistantPage() {
  const [input, setInput] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [dismissedProposalKeys, setDismissedProposalKeys] = useState<Set<string>>(new Set());
  const [proposalsOpen, setProposalsOpen] = useState(false);
  const terminalMessagePosted = useRef(false);
  const prevProposalCount = useRef(0);

  const startRun = useStartAgentRun();
  const cancelRun = useCancelAgentRun();
  const { data: runSnapshot } = useAgentRun(runId, !!runId);

  // Poll snapshot is source of truth for event history (avoids SSE + poll duplicates).
  useEffect(() => {
    if (!runSnapshot?.events) return;
    setEvents(runSnapshot.events);
  }, [runSnapshot?.events]);

  // Live SSE deltas between polls.
  useEffect(() => {
    if (!runId) return;
    terminalMessagePosted.current = false;
    const controller = new AbortController();
    void streamAgentRunEvents(
      runId,
      (event) => {
        setEvents((prev) => mergeAgentEvents(prev, [event]));
      },
      controller.signal,
    ).catch(() => {
      // polling covers updates
    });
    return () => controller.abort();
  }, [runId]);

  // Single assistant message when run ends (from snapshot, not duplicated from SSE).
  useEffect(() => {
    if (!runSnapshot || !TERMINAL_STATUSES.has(runSnapshot.status)) return;
    if (terminalMessagePosted.current) return;
    terminalMessagePosted.current = true;

    if (runSnapshot.status === "completed" && runSnapshot.finalMessage) {
      setMessages((m) => [...m, { role: "assistant", text: runSnapshot.finalMessage! }]);
    } else if (runSnapshot.status === "cancelled") {
      setMessages((m) => [...m, { role: "assistant", text: "Run cancelled." }]);
    } else if (runSnapshot.status === "failed" && runSnapshot.error) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: formatAssistantErrorMessage(runSnapshot.error!) },
      ]);
    }
  }, [runSnapshot?.status, runSnapshot?.finalMessage, runSnapshot?.error, runSnapshot]);

  const proposals: Proposal[] = useMemo(() => {
    const fromRun = runSnapshot?.proposals ?? [];
    const fromEvents = events
      .filter(
        (e): e is Extract<AgentEvent, { type: "proposal_added" }> => e.type === "proposal_added",
      )
      .map((e) => e.proposal);
    const merged = [...fromRun];
    for (const p of fromEvents) {
      if (!merged.some((x) => JSON.stringify(x) === JSON.stringify(p))) {
        merged.push(p);
      }
    }
    return merged;
  }, [runSnapshot?.proposals, events]);

  const visibleProposals = proposals.filter(
    (p) => !dismissedProposalKeys.has(proposalStableKey(p)),
  );

  useEffect(() => {
    const count = visibleProposals.length;
    if (count > 0 && count > prevProposalCount.current) {
      setProposalsOpen(true);
    }
    if (count === 0) {
      setProposalsOpen(false);
    }
    prevProposalCount.current = count;
  }, [visibleProposals.length]);

  const dismissProposal = (proposal: Proposal) => {
    setDismissedProposalKeys((s) => new Set(s).add(proposalStableKey(proposal)));
  };

  const isRunning =
    runSnapshot?.status === "planning" ||
    runSnapshot?.status === "executing" ||
    runSnapshot?.status === "reflecting" ||
    runSnapshot?.status === "proposing";

  const runningStatusHint = useMemo(() => {
    if (!isRunning) return null;
    const reflections = events.filter(
      (e): e is Extract<AgentEvent, { type: "reflection" }> => e.type === "reflection",
    );
    const lastReflection = reflections[reflections.length - 1];
    if (lastReflection) return lastReflection.message;
    const tools = events.filter(
      (e): e is Extract<AgentEvent, { type: "tool_called" }> => e.type === "tool_called",
    );
    const lastTool = tools[tools.length - 1];
    if (lastTool) return `Calling ${lastTool.toolName}…`;
    return "Agent running…";
  }, [isRunning, events]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setEvents([]);
    setDismissedProposalKeys(new Set());
    setProposalsOpen(false);
    prevProposalCount.current = 0;
    terminalMessagePosted.current = false;
    try {
      const { runId: id } = await startRun.mutateAsync(trimmed);
      setRunId(id);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Failed to start agent run";
      setMessages((m) => [...m, { role: "assistant", text: formatAssistantErrorMessage(raw) }]);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finance Assistant</h1>
        <p className="text-muted-foreground text-sm">
          AI agent with read access to your data. Proposed changes are applied only when you click
          Apply (via your browser session).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            variant="secondary"
            size="sm"
            disabled={isRunning || startRun.isPending}
            onClick={() => void submit(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">Chat</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 gap-3 min-h-[320px]">
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[280px]">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ask a question or pick a suggestion.
                </p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={
                    msg.role === "user"
                      ? "rounded-lg bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap"
                      : "rounded-lg bg-muted px-3 py-2"
                  }
                >
                  {msg.role === "assistant" ? <AssistantMarkdown content={msg.text} /> : msg.text}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about spending, categories, account names…"
                rows={2}
                disabled={isRunning || startRun.isPending}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit(input);
                  }
                }}
              />
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => void submit(input)}
                  disabled={isRunning || startRun.isPending || !input.trim()}
                >
                  Send
                </Button>
                {runId && isRunning && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void cancelRun.mutateAsync(runId)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Agent activity</CardTitle>
            {visibleProposals.length > 0 && !proposalsOpen && (
              <Button variant="secondary" size="sm" onClick={() => setProposalsOpen(true)}>
                {visibleProposals.length} proposal{visibleProposals.length === 1 ? "" : "s"}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isRunning && runningStatusHint && (
              <p className="text-xs text-muted-foreground mb-2 animate-pulse">
                {runningStatusHint}
              </p>
            )}
            <AgentActivityTimeline events={events} />
          </CardContent>
        </Card>
      </div>

      <ProposalsSheet
        open={proposalsOpen}
        onOpenChange={setProposalsOpen}
        proposals={visibleProposals}
        onDismiss={dismissProposal}
      />
    </div>
  );
}
