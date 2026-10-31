import { z } from "@ipo-mania/validation";

const environmentSchema = z.object({
  RUNTIME_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  WEB_APP_ORIGIN: z.string().url().optional(),
  UPSTOX_ACCESS_TOKEN: z.string().min(1).optional(),
  UPSTOX_API_URL: z.string().url().default("https://api.upstox.com/v2/ipo"),
  IPOS_MARKETS_API_URL: z.string().url().default("https://ipos.markets/api"),
  IPO_GURU_API_KEY: z.string().min(1).optional(),
});

export type EnvironmentBindings = {
  RUNTIME_ENV?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  WEB_APP_ORIGIN?: string;
  UPSTOX_ACCESS_TOKEN?: string;
  UPSTOX_API_URL?: string;
  IPOS_MARKETS_API_URL?: string;
  IPO_GURU_API_KEY?: string;
};

export function validateEnvironment(bindings: EnvironmentBindings) {
  return environmentSchema.parse(bindings);
}
