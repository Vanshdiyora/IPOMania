import { z } from "@ipo-mania/validation";

const environmentSchema = z.object({
  RUNTIME_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

export type EnvironmentBindings = {
  RUNTIME_ENV?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
};

export function validateEnvironment(bindings: EnvironmentBindings) {
  return environmentSchema.parse(bindings);
}
