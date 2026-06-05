import { ProposalCard } from "@/components/assistant/ProposalCard";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { proposalStableKey } from "@/lib/proposalKey";
import type { Proposal } from "@/types/assistant";

type ProposalsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposals: Proposal[];
  onDismiss: (proposal: Proposal) => void;
};

export function ProposalsSheet({ open, onOpenChange, proposals, onDismiss }: ProposalsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        aria-describedby="proposals-sheet-description"
      >
        <SheetHeader className="space-y-1 border-b px-6 py-4 text-left">
          <SheetTitle>Proposals</SheetTitle>
          <SheetDescription id="proposals-sheet-description">
            Review each change and click Apply. Nothing is saved until you confirm (via your
            session).
          </SheetDescription>
          {proposals.length > 0 && (
            <p className="text-xs text-muted-foreground pt-1">
              {proposals.length} pending change{proposals.length === 1 ? "" : "s"}
            </p>
          )}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {proposals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending proposals.</p>
          ) : (
            <div className="space-y-3">
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposalStableKey(proposal)}
                  proposal={proposal}
                  onDismiss={() => onDismiss(proposal)}
                />
              ))}
            </div>
          )}
        </div>

        {proposals.length > 0 && (
          <div className="border-t px-6 py-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
