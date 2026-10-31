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

export async function downloadApiFile(path: string, session: Session): Promise<void> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ""}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!response.ok) {
    const payload = (await response.json()) as ApiErrorResponse;
    throw new ApiRequestError(
      payload.error?.message ?? "The report could not be exported.",
      response.status,
    );
  }

  const filename =
    response.headers
      .get("Content-Disposition")
      ?.match(/filename="([^"]+)"/i)?.[1]
      ?.replace(/[\\/"\r\n]/g, "") ?? "ipo-mania-report";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
