export function getAuthRedirectUrl(
  path: "/auth/confirm" | "/reset-password",
  currentOrigin: string,
  configuredOrigin = import.meta.env.VITE_WEB_APP_ORIGIN,
): string {
  return new URL(path, configuredOrigin?.trim() || currentOrigin).toString();
}
