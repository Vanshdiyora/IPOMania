const THIRTY_DAYS_IN_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

type AuthStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

type StoredAuthValue = {
  value: string;
  expiresAt: number;
};

function parseStoredAuthValue(value: string): StoredAuthValue | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "value" in parsed &&
      "expiresAt" in parsed &&
      typeof parsed.value === "string" &&
      typeof parsed.expiresAt === "number" &&
      Number.isFinite(parsed.expiresAt)
    ) {
      return parsed as StoredAuthValue;
    }
  } catch {
    // This may be a session stored by the previous SDK configuration.
  }

  return null;
}

/**
 * Persists Supabase Auth values for at most 30 days from their first write.
 * Refreshing an access token keeps the original expiry so an active tab cannot
 * extend a login indefinitely.
 */
export function createThirtyDayAuthStorage(
  storage: AuthStorage,
  now: () => number = Date.now,
): AuthStorage {
  return {
    getItem(key) {
      const storedValue = storage.getItem(key);
      if (!storedValue) return null;

      const stored = parseStoredAuthValue(storedValue);
      if (!stored) {
        const expiresAt = now() + THIRTY_DAYS_IN_MILLISECONDS;
        storage.setItem(key, JSON.stringify({ value: storedValue, expiresAt }));
        return storedValue;
      }

      if (stored.expiresAt <= now()) {
        storage.removeItem(key);
        return null;
      }

      return stored.value;
    },
    removeItem(key) {
      storage.removeItem(key);
    },
    setItem(key, value) {
      const existing = storage.getItem(key);
      const stored = existing ? parseStoredAuthValue(existing) : null;
      const expiresAt =
        stored && stored.expiresAt > now() ? stored.expiresAt : now() + THIRTY_DAYS_IN_MILLISECONDS;

      storage.setItem(key, JSON.stringify({ value, expiresAt }));
    },
  };
}

export { THIRTY_DAYS_IN_MILLISECONDS };
