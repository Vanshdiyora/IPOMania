import { describe, expect, it } from "vitest";
import { applicationDrawerPath } from "../../apps/web/src/lib/applicationDrawer";

describe("application drawer path", () => {
  it("opens a new application drawer with the selected demat account prefilled", () => {
    expect(applicationDrawerPath("acc 1&2")).toBe("/applications/new?demat_account_id=acc+1%262");
  });

  it("keeps an IPO-details application flow scoped to its IPO and return page", () => {
    expect(applicationDrawerPath("account-id", "ipo-id", "/ipos/ipo-id")).toBe(
      "/applications/new?demat_account_id=account-id&ipo_id=ipo-id&return_to=%2Fipos%2Fipo-id",
    );
  });
});
