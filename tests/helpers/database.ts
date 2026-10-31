const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);

export function getLoopbackTestDatabaseUrl(environmentVariable: string): string | undefined {
  const databaseUrl = process.env[environmentVariable];
  if (!databaseUrl) return undefined;

  let hostname: string;
  try {
    hostname = new URL(databaseUrl).hostname;
  } catch {
    throw new Error(`${environmentVariable} must be a valid PostgreSQL URL.`);
  }

  if (!loopbackHosts.has(hostname)) {
    throw new Error(
      `${environmentVariable} must point to a loopback-only disposable test database.`,
    );
  }
  return databaseUrl;
}
