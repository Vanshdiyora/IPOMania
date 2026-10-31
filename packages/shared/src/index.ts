export interface ApiSuccessResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export interface HealthStatus {
  status: "ok";
  version: string;
  environment: "development" | "test" | "production";
}
