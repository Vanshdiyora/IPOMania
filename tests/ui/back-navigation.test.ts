import { describe, expect, it } from "vitest";
import { backDestination } from "../../apps/web/src/lib/navigation";

describe("backDestination", () => {
  const fallback = "/ipos?source=personal";
  const allowed = /^\/ipos$/;

  it("retains the originating list query and page", () => {
    expect(
      backDestination(
        { from: "/ipos?source=personal&search=Example&status=OPEN&page=3" },
        fallback,
        allowed,
      ),
    ).toBe("/ipos?source=personal&search=Example&status=OPEN&page=3");
  });

  it("returns to the signed-in dashboard when the detail link came from home", () => {
    expect(backDestination({ from: "/?category=RETAIL" }, fallback, /^\/(ipos|dashboard)?$/)).toBe(
      "/?category=RETAIL",
    );
  });

  it.each([
    null,
    {},
    { from: "https://example.com/ipos" },
    { from: "//example.com/ipos" },
    { from: "/admin/ipos" },
    { from: "/ipos/catalog/123" },
  ])("uses the parent route for unsafe or unrelated state: %j", (state) => {
    expect(backDestination(state, fallback, allowed)).toBe(fallback);
  });
});
