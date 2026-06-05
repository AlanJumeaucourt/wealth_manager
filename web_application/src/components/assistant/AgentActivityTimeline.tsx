import { AssistantMarkdown } from "@/components/assistant/AssistantMarkdown";
import type { AgentEvent } from "@/types/assistant";
import { cn } from "@/lib/utils";

export function AgentActivityTimeline({ events }: { events: AgentEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Agent activity will appear here as the run progresses.
      </p>
    );
  }

  return (
    <ul className="space-y-2 text-sm max-h-[420px] overflow-y-auto">
      {events.map((event, index) => (
        <li
          key={`${event.type}-${index}`}
          className={cn(
            "rounded-md border px-3 py-2",
            event.type === "run_failed" && "border-destructive/50 bg-destructive/5",
            event.type === "proposal_added" && "border-primary/30 bg-primary/5",
          )}
        >
          <EventLine event={event} />
        </li>
      ))}
    </ul>
  );
}

function EventLine({ event }: { event: AgentEvent }) {
  switch (event.type) {
    case "plan_created":
      return (
        <>
          <span className="font-medium">Plan</span>
          <ul className="mt-1 list-disc pl-4 text-muted-foreground">
            {event.plan.map((s) => (
              <li key={s.id}>{s.description}</li>
            ))}
          </ul>
        </>
      );
    case "tool_called":
      return (
        <span>
          <span className="font-medium">Tool</span> {event.toolName}
        </span>
      );
    case "tool_result":
      return (
        <span>
          <span className="font-medium">Result</span> {event.toolName}: {event.summary}
        </span>
      );
    case "reflection":
      return (
        <span>
          <span className="font-medium">Reflect</span> {event.message}
        </span>
      );
    case "proposal_added":
      return (
        <span>
          <span className="font-medium">Proposal</span> {event.proposal.kind} —{" "}
          {event.proposal.reason}
        </span>
      );
    case "run_completed":
      return (
        <div className="space-y-1">
          <span className="font-medium">Completed</span>
          <AssistantMarkdown content={event.finalMessage} className="text-muted-foreground" />
        </div>
      );
    case "run_failed":
      return (
        <span className="text-destructive">
          <span className="font-medium">Failed</span> {event.error}
        </span>
      );
    default:
      return <span>{(event as AgentEvent).type}</span>;
  }
}
