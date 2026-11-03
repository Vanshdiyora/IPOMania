export function applicationDrawerPath(accountId: string) {
  return `/applications/new?${new URLSearchParams({ demat_account_id: accountId }).toString()}`;
}
