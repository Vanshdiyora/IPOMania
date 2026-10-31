import { describe, expect, it } from "vitest";
import { getAuthRedirectUrl } from "../../apps/web/src/lib/authRedirect";

describe("getAuthRedirectUrl", () => {
  it("uses the configured public origin instead of the current browser origin", () => {
    expect(
      getAuthRedirectUrl(
        "/auth/confirm",
        "http://localhost:3000",
        "https://ipo-mania-web.vanshadiyora.workers.dev",
      ),
    ).toBe("https://ipo-mania-web.vanshadiyora.workers.dev/auth/confirm");
  });

  it("uses the current browser origin when no public origin is configured", () => {
    expect(getAuthRedirectUrl("/reset-password", "http://localhost:4175", "")).toBe(
      "http://localhost:4175/reset-password",
    );
  });
});
