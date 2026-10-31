import { z } from "@ipo-mania/validation";

const environmentSchema = z.object({
  RUNTIME_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  WEB_APP_ORIGIN: z.string().url().optional(),
});

export type EnvironmentBindings = {
  RUNTIME_ENV?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  WEB_APP_ORIGIN?: string;
};

export function validateEnvironment(bindings: EnvironmentBindings) {
  return environmentSchema.parse(bindings);
}
