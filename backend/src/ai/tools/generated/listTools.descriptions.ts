import { AGENT_LIST_ENDPOINTS } from "../../../db/manifest.js";
import { listQueryDescription } from "../../../schemas/openapi.js";

export const LIST_TOOL_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  AGENT_LIST_ENDPOINTS.map((ep) => [
    ep.toolName,
    `${ep.openApiPath}. ${listQueryDescription([...ep.allowedFilters], [...ep.searchFields])} Returns { items, total, page, per_page } unless noted.`,
  ]),
);
