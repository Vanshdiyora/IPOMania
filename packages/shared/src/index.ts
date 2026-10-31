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

export interface DematAccount {
  id: string;
  user_id: string;
  holder_name: string;
  broker_name: string;
  broker_code: string | null;
  depository_type: "NSDL" | "CDSL";
  masked_demat_identifier: string;
  masked_client_reference: string | null;
  account_status: "active" | "inactive" | "closed";
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface AccountImportPreviewRow {
  row_number: number;
  record: Omit<DematAccount, "id" | "user_id" | "created_at" | "updated_at" | "archived_at">;
  row_status: "ready" | "duplicate" | "invalid";
  errors: string[];
  warnings: string[];
}
