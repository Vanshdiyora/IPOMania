import { describe, expect, it } from "vitest";
import { isAdminEmail } from "@ipo-mania/shared";

describe("isAdminEmail", () => {
  it("allows only the configured administrator email", () => {
    expect(isAdminEmail("admin@gmail.com")).toBe(true);
    expect(isAdminEmail("ADMIN@gmail.com")).toBe(true);
    expect(isAdminEmail("other@gmail.com")).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});
