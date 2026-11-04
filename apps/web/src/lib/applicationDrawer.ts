export function applicationDrawerPath(accountId: string, ipoId?: string, returnTo?: string) {
  const params = new URLSearchParams({ demat_account_id: accountId });
  if (ipoId) params.set("ipo_id", ipoId);
  if (returnTo) params.set("return_to", returnTo);
  return `/applications/new?${params.toString()}`;
}
