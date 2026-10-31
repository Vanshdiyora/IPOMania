import type { Session } from "@supabase/supabase-js";

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiRequest<T>(
  path: string,
  session: Session,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ""}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
  });
  const payload = (await response.json()) as T | ApiErrorResponse;

  if (!response.ok) {
    const error = payload as ApiErrorResponse;
    throw new ApiRequestError(
      error.error?.message ?? "The request could not be completed.",
      response.status,
    );
  }

  return payload as T;
}
