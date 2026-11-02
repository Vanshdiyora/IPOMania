import { useState } from "react";
import type { z } from "@ipo-mania/validation";

export function useFormValidation() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  function validate<T>(schema: z.ZodType<T>, values: unknown): T {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join(".");
        next[field] ??= issue.message;
      }
      setErrors(next);
      throw new Error("Check the highlighted fields and try again.");
    }
    setErrors({});
    return parsed.data;
  }
  return { errors, validate };
}
