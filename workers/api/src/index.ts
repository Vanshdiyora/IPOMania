import { createApp } from "./app";
import type { EnvironmentBindings } from "./env";
import { createServiceSupabaseClient } from "./db/supabase";
import { runIpoSync } from "./routes/admin-ipos";

const app = createApp();

const worker = {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, environment: EnvironmentBindings) {
    const supabase = createServiceSupabaseClient(environment);
    await runIpoSync(supabase, "scheduled", environment);
  },
};

export default worker;
export { createApp };
