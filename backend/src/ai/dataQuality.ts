import {
  categoriesByType,
  expenseCategories,
  incomeCategories,
  transferCategories,
} from "../categories.js";
import { executeListTool } from "./tools/listToolDispatcher.js";
import type { ListToolContext } from "./tools/listToolDispatcher.js";

const WEAK_CATEGORIES = new Set(["Autres dépenses", "Autres rentrées"]);

const PLACEHOLDER_ACCOUNT_RE = /^(unknown|unnamed|compte|account)(\s*\d*)?$/i;

function allValidCategories(): Set<string> {
  const set = new Set<string>();
  for (const type of ["expense", "income", "transfer"] as const) {
    for (const cat of categoriesByType[type] ?? []) {
      set.add(cat.name.fr);
      set.add(cat.name.en);
      for (const sub of cat.subCategories ?? []) {
        set.add(sub.name.fr);
        set.add(sub.name.en);
      }
    }
  }
  return set;
}

const VALID_CATEGORIES = allValidCategories();

function parentHasSubcategories(category: string): boolean {
  for (const type of ["expense", "income", "transfer"] as const) {
    const parent = categoriesByType[type]?.find(
      (c) => c.name.fr === category || c.name.en === category,
    );
    if (parent?.subCategories && parent.subCategories.length > 0) return true;
  }
  return false;
}

function isWeakCategory(category: string, type: string): boolean {
  if (WEAK_CATEGORIES.has(category)) return true;
  const valid =
    type === "income"
      ? incomeCategories
      : type === "transfer"
        ? transferCategories
        : expenseCategories;
  return !valid.includes(category) && !VALID_CATEGORIES.has(category);
}

function isPlaceholderAccountName(name: string, type: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 3) return true;
  if (PLACEHOLDER_ACCOUNT_RE.test(trimmed)) return true;
  if (trimmed.toLowerCase() === type.toLowerCase()) return true;
  return false;
}

export type DataQualityIssue =
  | {
      kind: "weak_category";
      transactionId: number;
      description: string;
      category: string;
      type: string;
    }
  | {
      kind: "missing_subcategory";
      transactionId: number;
      description: string;
      category: string;
    }
  | {
      kind: "placeholder_account_name";
      accountId: number;
      name: string;
      type: string;
    };

export async function findDataQualityIssues(
  ctx: ListToolContext,
  options?: { transactionLimit?: number },
): Promise<{ issues: DataQualityIssue[]; scannedTransactions: number; scannedAccounts: number }> {
  const limit = options?.transactionLimit ?? 500;
  const [txResult, accResult] = await Promise.all([
    executeListTool(
      "list_transactions",
      { per_page: limit, page: 1, sort_by: "date", sort_order: "desc" },
      ctx,
    ),
    executeListTool("list_accounts", { per_page: 200, page: 1 }, ctx),
  ]);

  const issues: DataQualityIssue[] = [];

  if (txResult && typeof txResult === "object" && "items" in txResult) {
    const items = (txResult as { items: Array<Record<string, unknown>> }).items;
    for (const tx of items) {
      const id = tx.id as number;
      const category = typeof tx.category === "string" ? tx.category : "";
      const type = typeof tx.type === "string" ? tx.type : "expense";
      const description = typeof tx.description === "string" ? tx.description : "";
      if (isWeakCategory(category, type)) {
        issues.push({ kind: "weak_category", transactionId: id, description, category, type });
      } else if (
        parentHasSubcategories(category) &&
        (tx.subcategory == null || tx.subcategory === "")
      ) {
        issues.push({ kind: "missing_subcategory", transactionId: id, description, category });
      }
    }
  }

  if (accResult && typeof accResult === "object" && "items" in accResult) {
    const items = (accResult as { items: Array<Record<string, unknown>> }).items;
    for (const acc of items) {
      const name = typeof acc.name === "string" ? acc.name : "";
      const type = typeof acc.type === "string" ? acc.type : "";
      if (isPlaceholderAccountName(name, type)) {
        issues.push({
          kind: "placeholder_account_name",
          accountId: acc.id as number,
          name,
          type,
        });
      }
    }
  }

  return {
    issues,
    scannedTransactions:
      txResult && typeof txResult === "object" && "items" in txResult
        ? (txResult as { items: unknown[] }).items.length
        : 0,
    scannedAccounts:
      accResult && typeof accResult === "object" && "items" in accResult
        ? (accResult as { items: unknown[] }).items.length
        : 0,
  };
}
