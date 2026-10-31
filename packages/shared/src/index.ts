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

export type IpoStatus =
  | "UPCOMING"
  | "OPEN"
  | "CLOSED"
  | "ALLOTMENT_PENDING"
  | "LISTED"
  | "WITHDRAWN";

export type IpoCategoryCode = "RETAIL" | "SHNI" | "BHNI" | "SHAREHOLDER";

export interface IpoRecord {
  id: string;
  company_name: string;
  symbol: string;
  ipo_type: string;
  exchange: string;
  issue_price_min: string;
  issue_price_max: string;
  cut_off_price: string | null;
  lot_size: number;
  issue_size: string;
  opening_date: string;
  closing_date: string;
  allotment_date: string | null;
  listing_date: string | null;
  status: IpoStatus;
  data_source: "MANUAL" | "PUBLISHED_SOURCE";
  source_reference: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface IpoEligibilityCondition {
  id: string;
  description: string;
}

export interface IpoCategoryConfiguration {
  id: string;
  ipo_id: string;
  category: IpoCategoryCode;
  rule_version: number;
  lot_limit_status: "CONFIGURED" | "NO_PUBLISHED_LIMIT" | "UNCONFIGURED";
  minimum_lots: number | null;
  maximum_lots: number | null;
  lot_increment: number;
  investment_limit_status: "CONFIGURED" | "NO_PUBLISHED_LIMIT" | "UNCONFIGURED";
  minimum_investment: string | null;
  maximum_investment: string | null;
  reserved_shares: number | null;
  reserved_percentage: string | null;
  shareholder_record_date: string | null;
  minimum_shareholding: number | null;
  eligibility_conditions: IpoEligibilityCondition[];
  allowed_price_types: Array<"BID" | "CUT_OFF">;
  minimum_price_increment: string | null;
  source_reference: string | null;
  rule_source: "MANUAL" | "PUBLISHED_SOURCE";
  last_verified_at: string | null;
  created_at: string;
}

export interface IpoCalculationAudit {
  id: string;
  ipo_id: string;
  category: IpoCategoryCode;
  rule_version: number;
  calculation_timestamp: string;
  input_snapshot: Record<string, unknown>;
  result_snapshot: Record<string, unknown>;
}

export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_PROCESSING"
  | "REJECTED"
  | "FAILED"
  | "COMPLETED";
export type MandateStatus =
  | "UNKNOWN"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "FAILED"
  | "NOT_REQUIRED";
export type AllotmentStatus =
  | "UNKNOWN"
  | "PENDING"
  | "ALLOTTED"
  | "PARTIALLY_ALLOTTED"
  | "NOT_ALLOTTED";

export interface IpoApplication {
  id: string;
  user_id: string;
  ipo_id: string;
  demat_account_id: string;
  category_id: string;
  lots: number;
  total_shares: number;
  application_amount: string;
  application_number: string | null;
  external_reference: string | null;
  submission_date: string | null;
  application_status: ApplicationStatus;
  mandate_status: MandateStatus;
  allotment_status: AllotmentStatus;
  notes: string | null;
  rule_version: number;
  calculation_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ApplicationImportRow {
  row_number: number;
  record: Record<string, unknown>;
  row_status: "ready" | "duplicate" | "invalid" | "imported";
  errors: string[];
  warnings: string[];
  created_application_id: string | null;
}
