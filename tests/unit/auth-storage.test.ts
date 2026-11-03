import { describe, expect, it } from "vitest";
import {
  createThirtyDayAuthStorage,
  THIRTY_DAYS_IN_MILLISECONDS,
} from "../../apps/web/src/lib/authStorage";

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("createThirtyDayAuthStorage", () => {
  it("restores a stored auth value until 30 days have elapsed", () => {
    const storage = createMemoryStorage();
    let currentTime = 1_000;
    const authStorage = createThirtyDayAuthStorage(storage, () => currentTime);

    authStorage.setItem("session", "first-session");
    currentTime += THIRTY_DAYS_IN_MILLISECONDS - 1;

    expect(authStorage.getItem("session")).toBe("first-session");

    currentTime += 1;
    expect(authStorage.getItem("session")).toBeNull();
    expect(storage.getItem("session")).toBeNull();
  });

  it("does not extend the expiry when Supabase refreshes a token", () => {
    const storage = createMemoryStorage();
    let currentTime = 1_000;
    const authStorage = createThirtyDayAuthStorage(storage, () => currentTime);

    authStorage.setItem("session", "original-token");
    currentTime += 10 * 24 * 60 * 60 * 1000;
    authStorage.setItem("session", "refreshed-token");
    currentTime += 20 * 24 * 60 * 60 * 1000;

    expect(authStorage.getItem("session")).toBeNull();
  });

  it("upgrades an existing unwrapped Supabase session without signing the user out", () => {
    const storage = createMemoryStorage();
    storage.setItem("session", "legacy-session");
    const authStorage = createThirtyDayAuthStorage(storage, () => 1_000);

    expect(authStorage.getItem("session")).toBe("legacy-session");
    expect(storage.getItem("session")).toContain("legacy-session");
  });
});
