import { AGENT_LIST_ENDPOINTS } from "../../../db/manifest.js";
import type { OpenAiToolDefinition } from "../../openrouter.js";
import { buildListToolParametersSchema } from "../typeboxToJsonSchema.js";
import { LIST_TOOL_DESCRIPTIONS } from "./listTools.descriptions.js";

export const LIST_OPENAI_TOOLS: OpenAiToolDefinition[] = AGENT_LIST_ENDPOINTS.map((ep) => ({
  type: "function" as const,
  function: {
    name: ep.toolName,
    description: LIST_TOOL_DESCRIPTIONS[ep.toolName] ?? ep.openApiPath,
    parameters: buildListToolParametersSchema(ep.allowedFilters),
  },
}));
