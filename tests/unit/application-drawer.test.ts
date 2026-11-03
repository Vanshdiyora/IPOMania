import { describe, expect, it } from "vitest";
import { applicationDrawerPath } from "../../apps/web/src/lib/applicationDrawer";

describe("application drawer path", () => {
  it("opens a new application drawer with the selected demat account prefilled", () => {
    expect(applicationDrawerPath("acc 1&2")).toBe("/applications/new?demat_account_id=acc+1%262");
  });
});
