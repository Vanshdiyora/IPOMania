import { afterEach, describe, expect, it, vi } from "vitest";
import { getLoopbackTestDatabaseUrl } from "../helpers/database";

afterEach(() => vi.unstubAllEnvs());

describe("isolated integration database configuration", () => {
  it("returns no connection string when the opt-in variable is absent", () => {
    vi.stubEnv("TEST_DATABASE_URL", "");
    expect(getLoopbackTestDatabaseUrl("TEST_DATABASE_URL")).toBeUndefined();
  });

  it("accepts loopback PostgreSQL URLs for disposable tests", () => {
    vi.stubEnv("TEST_DATABASE_URL", "postgres://test:test@127.0.0.1:54322/postgres");
    expect(getLoopbackTestDatabaseUrl("TEST_DATABASE_URL")).toContain("127.0.0.1");
  });

  it("rejects remote database URLs", () => {
    vi.stubEnv("TEST_DATABASE_URL", "postgres://test:test@db.example.test:5432/postgres");
    expect(() => getLoopbackTestDatabaseUrl("TEST_DATABASE_URL")).toThrow(
      "loopback-only disposable test database",
    );
  });

  it("rejects malformed database URLs explicitly", () => {
    vi.stubEnv("TEST_DATABASE_URL", "not-a-url");
    expect(() => getLoopbackTestDatabaseUrl("TEST_DATABASE_URL")).toThrow(
      "must be a valid PostgreSQL URL",
    );
  });
});
