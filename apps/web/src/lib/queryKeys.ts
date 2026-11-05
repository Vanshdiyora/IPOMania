// The owner is the final segment so existing domain-prefix invalidation stays precise.
export function userQueryKey<T extends readonly unknown[]>(userId: string | undefined, key: T) {
  return [...key, { userId: userId ?? null }] as const;
}

export const queryKeys = {
  profile: (userId: string | undefined) => userQueryKey(userId, ["profile"] as const),
  accounts: {
    allOptions: (userId: string | undefined) =>
      userQueryKey(userId, ["accounts", "all-options"] as const),
  },
  admin: {
    overview: (userId: string | undefined) => userQueryKey(userId, ["admin", "overview"] as const),
    status: (userId: string | undefined) => userQueryKey(userId, ["admin", "sync-status"] as const),
    catalog: (userId: string | undefined) => userQueryKey(userId, ["admin", "catalog"] as const),
  },
  ipo: {
    detail: (userId: string | undefined, ipoId: string) =>
      userQueryKey(userId, ["ipo", ipoId] as const),
    catalogDetail: (userId: string | undefined, ipoId: string) =>
      userQueryKey(userId, ["ipo-catalog", ipoId] as const),
  },
} as const;
