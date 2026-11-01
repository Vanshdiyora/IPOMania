import { z } from "@ipo-mania/validation";

const environmentSchema = z.object({
  RUNTIME_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  WEB_APP_ORIGIN: z.string().url().optional(),
  IPO_GURU_API_URL: z.string().url().default("https://www.ipoguru.in/api/v2/ipos"),
  IPO_GURU_API_KEY: z.string().min(1).optional(),
  IPO_SYNC_INTERVAL_HOURS: z.coerce.number().positive().max(168).default(3),
});

export type EnvironmentBindings = {
  RUNTIME_ENV?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  WEB_APP_ORIGIN?: string;
  IPO_GURU_API_URL?: string;
  IPO_GURU_API_KEY?: string;
  IPO_SYNC_INTERVAL_HOURS?: number | string;
};

export function validateEnvironment(bindings: EnvironmentBindings) {
  return environmentSchema.parse(bindings);
}
