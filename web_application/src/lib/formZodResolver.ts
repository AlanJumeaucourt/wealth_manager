import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { ZodTypeAny } from "zod";

/** Bridge web-app Zod v3 schemas with hoisted @hookform/resolvers Zod v4 types. */
export function formZodResolver<T extends FieldValues>(schema: ZodTypeAny): Resolver<T> {
  return zodResolver(schema as never) as Resolver<T>;
}
