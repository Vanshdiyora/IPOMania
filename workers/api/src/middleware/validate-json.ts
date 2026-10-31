import { zValidator } from "@hono/zod-validator";
import type { ZodType } from "zod";

export function validateJson<T extends ZodType>(schema: T) {
  return zValidator("json", schema, (result, context) => {
    if (!result.success) {
      return context.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed.",
          },
        },
        400,
      );
    }
  });
}
