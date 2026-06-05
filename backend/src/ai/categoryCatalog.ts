import { categoriesByType, type Category } from "../categories.js";

/** Compact parent + subcategory names (French only) for agent tool responses. */
export type AgentCategoryEntry = {
  name: string;
  subcategories: string[];
};

function compactCategory(cat: Category): AgentCategoryEntry {
  const subs = cat.subCategories ?? [];
  return {
    name: cat.name.fr,
    subcategories: subs.map((s) => s.name.fr),
  };
}

/** French-only category tree for LLM tools (no icons/colors/English). */
export function getAgentCategoryCatalog(): Record<string, AgentCategoryEntry[]> {
  const out: Record<string, AgentCategoryEntry[]> = {};
  for (const [type, categories] of Object.entries(categoriesByType)) {
    out[type] = categories.map(compactCategory);
  }
  return out;
}
