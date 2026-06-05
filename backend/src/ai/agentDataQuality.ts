import type { DataQualityIssue } from "./dataQuality.js";

const AGENT_ISSUE_CAP = 40;

/** Compact factual scan for the LLM (no server-side category suggestions). */
export function formatDataQualityForAgent(result: {
  issues: DataQualityIssue[];
  scannedTransactions: number;
  scannedAccounts: number;
}): {
  scannedTransactions: number;
  scannedAccounts: number;
  issueCount: number;
  truncated: boolean;
  issues: Array<Record<string, unknown>>;
} {
  const capped = result.issues.slice(0, AGENT_ISSUE_CAP);
  return {
    scannedTransactions: result.scannedTransactions,
    scannedAccounts: result.scannedAccounts,
    issueCount: result.issues.length,
    truncated: result.issues.length > capped.length,
    issues: capped.map((issue) => {
      if (issue.kind === "placeholder_account_name") {
        return {
          kind: issue.kind,
          accountId: issue.accountId,
          name: issue.name,
          type: issue.type,
        };
      }
      if (issue.kind === "missing_subcategory") {
        return {
          kind: issue.kind,
          transactionId: issue.transactionId,
          description: issue.description,
          category: issue.category,
        };
      }
      return {
        kind: issue.kind,
        transactionId: issue.transactionId,
        description: issue.description,
        category: issue.category,
        type: issue.type,
      };
    }),
  };
}
