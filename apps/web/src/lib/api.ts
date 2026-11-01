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
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function errorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const apiError = (payload as ApiErrorResponse).error;
    if (apiError?.message && !/[<>{}\n]/.test(apiError.message)) return apiError.message;
  }
  return fallback;
}

function fallbackMessage(status: number, action = "The request could not be completed."): string {
  if (status === 0) return "Unable to reach the server. Check your connection and try again.";
  if (status === 401 || status === 403)
    return "Your session is not authorized. Please sign in again.";
  if (status === 404) return "The requested service was not found. Please try again later.";
  if (status >= 500) return "The server is temporarily unavailable. Please try again later.";
  return action;
}

export async function apiRequest<T>(
  path: string,
  session: Session,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ""}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(init.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiRequestError(fallbackMessage(0), 0);
  }

  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = payload as ApiErrorResponse | null;
    throw new ApiRequestError(
      errorMessage(payload, fallbackMessage(response.status)),
      response.status,
      error?.error?.code,
    );
  }

  return payload as T;
}

export async function downloadApiFile(path: string, session: Session): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ""}${path}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    throw new ApiRequestError(fallbackMessage(0), 0);
  }

  if (!response.ok) {
    const payload = await parseResponse(response);
    const error = payload as ApiErrorResponse | null;
    throw new ApiRequestError(
      errorMessage(payload, fallbackMessage(response.status, "The report could not be exported.")),
      response.status,
      error?.error?.code,
    );
  }

  const filename =
    response.headers
      .get("Content-Disposition")
      ?.match(/filename="([^"]+)"/i)?.[1]
      ?.replace(/["\r\n]/g, "")
      .replaceAll("\\", "")
      .replaceAll("/", "") ?? "ipo-mania-report";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
