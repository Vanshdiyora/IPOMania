import { describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "../../apps/web/src/lib/queryClient";
import { queryKeys, userQueryKey } from "../../apps/web/src/lib/queryKeys";
import { createAppStore } from "../../apps/web/src/store";
import { setDashboardFilters } from "../../apps/web/src/store/slices/dashboardFiltersSlice";
import { setMobileNavigationOpen } from "../../apps/web/src/store/slices/uiSlice";
import { setSigningOut } from "../../apps/web/src/store/slices/authUiSlice";
import { clearSessionState } from "../../apps/web/src/auth/clearSessionState";

describe("browser state ownership", () => {
  it("deduplicates active requests and reuses fresh data", async () => {
    const client = createAppQueryClient();
    const queryFn = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { data: ["one"] };
    });
    const queryKey = userQueryKey("user-a", ["ipos", "catalog", "page=1"]);
    const [first, second] = await Promise.all([
      client.fetchQuery({ queryKey, queryFn }),
      client.fetchQuery({ queryKey, queryFn }),
    ]);
    expect(first).toEqual(second);
    expect(queryFn).toHaveBeenCalledTimes(1);
    await client.fetchQuery({ queryKey, queryFn });
    expect(queryFn).toHaveBeenCalledTimes(1);
    await client.invalidateQueries({ queryKey: ["ipos"] });
    await client.fetchQuery({ queryKey, queryFn });
    expect(queryFn).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it("keeps parameters and users in distinct keys, then clears private state", async () => {
    const client = createAppQueryClient();
    const store = createAppStore();
    const userA = queryKeys.profile("user-a");
    const userB = queryKeys.profile("user-b");
    client.setQueryData(userA, { data: { full_name: "Alice" } });
    client.setQueryData(userB, { data: { full_name: "Bob" } });
    expect(client.getQueryData(userB)).toEqual({ data: { full_name: "Bob" } });
    expect(userQueryKey("user-a", ["ipos", "page=1"])).not.toEqual(
      userQueryKey("user-a", ["ipos", "page=2"]),
    );
    store.dispatch(setMobileNavigationOpen(true));
    store.dispatch(setSigningOut(true));
    store.dispatch(
      setDashboardFilters({
        date_from: "2026-11-01",
        date_to: "",
        ipo_id: "",
        catalog_ipo_id: "",
        category: "",
        account_id: "",
      }),
    );
    clearSessionState(client, store.dispatch);
    expect(client.getQueryData(userA)).toBeUndefined();
    expect(client.getQueryData(userB)).toBeUndefined();
    expect(store.getState().dashboardFilters.date_from).toBe("");
    expect(store.getState().ui.mobileNavigationOpen).toBe(false);
    expect(store.getState().authUi.signingOut).toBe(false);
  });
});
