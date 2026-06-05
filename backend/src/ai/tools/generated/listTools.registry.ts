import { AGENT_LIST_ENDPOINTS } from "../../../db/manifest.js";
import {
  AGENT_LIST_HANDLER_EXPORTS,
  budgetsLegacyListHandler,
  investmentsListHandler,
  liabilityPaymentsListHandler,
  potentialRefundsListHandler,
} from "../../../services/agentListHandlers.js";
import type { AgentListEndpointDef } from "../../../db/manifest.js";
import type { AgentListHandlerFn } from "../../../services/agentListHandlers.js";
import type { ListToolName } from "./listTools.types.js";

function resolveHandler(ep: AgentListEndpointDef): AgentListHandlerFn {
  switch (ep.executorKind) {
    case "handler_export":
      if (!ep.handlerExport || !AGENT_LIST_HANDLER_EXPORTS[ep.handlerExport]) {
        throw new Error(`Missing handler export for ${ep.toolName}`);
      }
      return AGENT_LIST_HANDLER_EXPORTS[ep.handlerExport]!;
    case "budgets_legacy":
      return budgetsLegacyListHandler;
    case "liability_payments":
      return liabilityPaymentsListHandler;
    case "potential_refunds":
      return potentialRefundsListHandler;
    case "investments":
      return investmentsListHandler;
    case "liabilities_payment_status":
      return AGENT_LIST_HANDLER_EXPORTS.liabilitiesPaymentStatusHandler!;
    case "liabilities_schedule_payments":
      return AGENT_LIST_HANDLER_EXPORTS.liabilitiesUpcomingPaymentsHandler!;
    default:
      throw new Error(`Unknown executor kind for ${ep.toolName}`);
  }
}

export type ListToolRegistryEntry = {
  toolName: ListToolName;
  querySchemaExport: string;
  handler: AgentListHandlerFn;
  allowedFilters: readonly string[];
  searchFields: readonly string[];
};

export const LIST_TOOL_REGISTRY: Record<ListToolName, ListToolRegistryEntry> = Object.fromEntries(
  AGENT_LIST_ENDPOINTS.map((ep) => [
    ep.toolName,
    {
      toolName: ep.toolName as ListToolName,
      querySchemaExport: ep.querySchemaExport,
      handler: resolveHandler(ep),
      allowedFilters: ep.allowedFilters,
      searchFields: ep.searchFields,
    },
  ]),
) as Record<ListToolName, ListToolRegistryEntry>;
