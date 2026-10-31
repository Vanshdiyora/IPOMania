import { Hono, type Context } from "hono";
import * as XLSX from "@e965/xlsx";
import {
  accountListQuerySchema,
  dematAccountSchema,
  dematAccountUpdateSchema,
} from "@ipo-mania/validation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AccountImportPreviewRow, DematAccount } from "@ipo-mania/shared";
import type { EnvironmentBindings } from "../env";
import { authenticate } from "../middleware/authenticate";
import { validateJson } from "../middleware/validate-json";

const maxUploadBytes = 5 * 1024 * 1024;
const maxImportRows = 500;
const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const accountColumns =
  "id, user_id, holder_name, broker_name, broker_code, depository_type, masked_demat_identifier, masked_client_reference, account_status, notes, created_at, updated_at, archived_at";

type AccountContext = {
  Bindings: EnvironmentBindings;
  Variables: { authenticatedUser: User; rlsSupabase: SupabaseClient };
};
type AccountRouteContext = Context<AccountContext>;

type ColumnMapping = Partial<
  Record<
    | "holder_name"
    | "broker_name"
    | "broker_code"
    | "depository_type"
    | "masked_demat_identifier"
    | "masked_client_reference"
    | "account_status"
    | "notes",
    string
  >
>;

type ParsedRow = {
  row_number: number;
  values: Record<string, string>;
};

export const accountsRoutes = new Hono<AccountContext>();

accountsRoutes.use("*", authenticate);

accountsRoutes.get("/", async (context) => {
  const parsedQuery = accountListQuerySchema.safeParse(context.req.query());
  if (!parsedQuery.success) {
    return context.json(
      { error: { code: "VALIDATION_ERROR", message: "Account filters are invalid." } },
      400,
    );
  }

  const query = parsedQuery.data;
  const userId = context.get("authenticatedUser").id;
  const supabase = context.get("rlsSupabase");
  let accountsQuery = supabase
    .from("demat_accounts")
    .select(accountColumns, { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (query.archived === "true") accountsQuery = accountsQuery.not("archived_at", "is", null);
  if (query.archived === "false") accountsQuery = accountsQuery.is("archived_at", null);
  if (query.holder_name) {
    accountsQuery = accountsQuery.ilike("holder_name", `${escapeLike(query.holder_name)}%`);
  }
  if (query.broker)
    accountsQuery = accountsQuery.ilike("broker_name", `${escapeLike(query.broker)}%`);
  if (query.depository) accountsQuery = accountsQuery.eq("depository_type", query.depository);
  if (query.status) accountsQuery = accountsQuery.eq("account_status", query.status);
  if (query.created_from) accountsQuery = accountsQuery.gte("created_at", query.created_from);
  if (query.created_to) accountsQuery = accountsQuery.lte("created_at", query.created_to);

  const [accountsResult, totalResult, activeResult, archivedResult] = await Promise.all([
    accountsQuery.range((query.page - 1) * query.pageSize, query.page * query.pageSize - 1),
    supabase
      .from("demat_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("demat_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("account_status", "active")
      .is("archived_at", null),
    supabase
      .from("demat_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("archived_at", "is", null),
  ]);
  if (accountsResult.error) throw accountsResult.error;
  if (totalResult.error) throw totalResult.error;
  if (activeResult.error) throw activeResult.error;
  if (archivedResult.error) throw archivedResult.error;

  const total = accountsResult.count ?? 0;
  const active = activeResult.count ?? 0;
  const archived = archivedResult.count ?? 0;
  return context.json({
    data: {
      accounts: accountsResult.data as DematAccount[],
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
      summary: {
        total: totalResult.count ?? 0,
        active,
        archived,
        remainingCapacity: 500 - active,
      },
    },
  });
});

accountsRoutes.post("/", validateJson(dematAccountSchema), async (context) => {
  const payload = context.req.valid("json");
  const { data, error } = await context
    .get("rlsSupabase")
    .from("demat_accounts")
    .insert({ ...payload, user_id: context.get("authenticatedUser").id })
    .select(accountColumns)
    .single();

  if (error) return databaseError(context, error);
  return context.json({ data: data as DematAccount }, 201);
});

accountsRoutes.get("/:accountId", async (context) => {
  const accountId = context.req.param("accountId");
  if (!isUuid(accountId)) return accountNotFound(context);
  const { data, error } = await context
    .get("rlsSupabase")
    .from("demat_accounts")
    .select(accountColumns)
    .eq("id", accountId)
    .eq("user_id", context.get("authenticatedUser").id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return accountNotFound(context);
  return context.json({ data: data as DematAccount });
});

accountsRoutes.patch("/:accountId", validateJson(dematAccountUpdateSchema), async (context) => {
  const accountId = context.req.param("accountId");
  if (!isUuid(accountId)) return accountNotFound(context);
  const updates = context.req.valid("json");
  if (Object.keys(updates).length === 0) {
    return context.json(
      { error: { code: "VALIDATION_ERROR", message: "Provide at least one account field." } },
      400,
    );
  }

  const { data, error } = await context
    .get("rlsSupabase")
    .from("demat_accounts")
    .update(updates)
    .eq("id", accountId)
    .eq("user_id", context.get("authenticatedUser").id)
    .is("archived_at", null)
    .select(accountColumns)
    .maybeSingle();

  if (error) return databaseError(context, error);
  if (!data) return accountNotFound(context);
  return context.json({ data: data as DematAccount });
});

accountsRoutes.post("/:accountId/archive", async (context) =>
  setArchived(context, context.req.param("accountId"), true),
);
accountsRoutes.post("/:accountId/restore", async (context) =>
  setArchived(context, context.req.param("accountId"), false),
);

accountsRoutes.delete("/:accountId", async (context) => {
  const accountId = context.req.param("accountId");
  if (!isUuid(accountId)) return accountNotFound(context);
  const { data, error } = await context
    .get("rlsSupabase")
    .from("demat_accounts")
    .delete()
    .eq("id", accountId)
    .eq("user_id", context.get("authenticatedUser").id)
    .not("archived_at", "is", null)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23503") {
      return context.json(
        {
          error: {
            code: "ACCOUNT_HAS_HISTORY",
            message: "This account has linked history and cannot be deleted.",
          },
        },
        409,
      );
    }
    throw error;
  }
  if (!data) return accountNotFound(context);
  return context.json({ data: { deleted: true } });
});

accountsRoutes.post("/import/preview", previewImport);
accountsRoutes.post("/import/confirm", async (context) => {
  const body = await readJsonBody(context);
  if (!body || typeof body !== "object" || !("import_id" in body) || !isUuid(body.import_id)) {
    return context.json(
      { error: { code: "VALIDATION_ERROR", message: "A valid import_id is required." } },
      400,
    );
  }
  const { data, error } = await context
    .get("rlsSupabase")
    .rpc("confirm_account_import", { p_import_id: body.import_id });
  if (error) return databaseError(context, error);
  return context.json({ data });
});

accountsRoutes.get("/import/history", async (context) => {
  const page = parsePositiveInteger(context.req.query("page"), 1);
  const pageSize = Math.min(parsePositiveInteger(context.req.query("pageSize"), 25), 100);
  if (!page || !pageSize) {
    return context.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Pagination values must be positive integers.",
        },
      },
      400,
    );
  }
  const { data, error, count } = await context
    .get("rlsSupabase")
    .from("account_imports")
    .select(
      "id, file_name, file_type, status, total_rows, imported_rows, created_at, confirmed_at, reversed_at",
      {
        count: "exact",
      },
    )
    .eq("user_id", context.get("authenticatedUser").id)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return context.json({
    data: { imports: data, page, pageSize, total: count ?? 0 },
  });
});

accountsRoutes.get("/import/:importId", async (context) => {
  const importId = context.req.param("importId");
  if (!isUuid(importId)) return importNotFound(context);
  const supabase = context.get("rlsSupabase");
  const { data: importRecord, error: importError } = await supabase
    .from("account_imports")
    .select(
      "id, file_name, file_type, status, total_rows, imported_rows, created_at, confirmed_at, reversed_at",
    )
    .eq("id", importId)
    .eq("user_id", context.get("authenticatedUser").id)
    .maybeSingle();
  if (importError) throw importError;
  if (!importRecord) return importNotFound(context);
  const { data: rows, error: rowsError } = await supabase
    .from("account_import_rows")
    .select("row_number, row_status, record, errors, warnings, created_account_id")
    .eq("import_id", importId)
    .order("row_number");
  if (rowsError) throw rowsError;
  return context.json({ data: { import: importRecord, rows } });
});

accountsRoutes.post("/import/:importId/reverse", async (context) => {
  const importId = context.req.param("importId");
  if (!isUuid(importId)) return importNotFound(context);
  const { data, error } = await context
    .get("rlsSupabase")
    .rpc("reverse_account_import", { p_import_id: importId });
  if (error) return databaseError(context, error);
  return context.json({ data });
});

async function setArchived(context: AccountRouteContext, accountId: string, archived: boolean) {
  if (!isUuid(accountId)) return accountNotFound(context);
  let query = context
    .get("rlsSupabase")
    .from("demat_accounts")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", accountId)
    .eq("user_id", context.get("authenticatedUser").id);
  query = archived ? query.is("archived_at", null) : query.not("archived_at", "is", null);
  const { data, error } = await query.select(accountColumns).maybeSingle();
  if (error) return databaseError(context, error);
  if (!data) return accountNotFound(context);
  return context.json({ data: data as DematAccount });
}

async function previewImport(context: AccountRouteContext) {
  const contentLength = Number(context.req.header("Content-Length") ?? 0);
  if (contentLength > maxUploadBytes + 1024) {
    return context.json(
      { error: { code: "FILE_TOO_LARGE", message: "Import files must be 5 MB or smaller." } },
      413,
    );
  }

  const form = await context.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return context.json(
      { error: { code: "VALIDATION_ERROR", message: "Choose a CSV or XLSX file to import." } },
      400,
    );
  }
  if (file.size === 0 || file.size > maxUploadBytes) {
    return context.json(
      {
        error: { code: "FILE_TOO_LARGE", message: "Import files must be between 1 byte and 5 MB." },
      },
      413,
    );
  }
  const fileType = file.type.toLowerCase();
  const fileName = file.name.trim();
  if (!fileName || fileName.length > 255 || hasControlCharacters(fileName)) {
    return context.json(
      { error: { code: "INVALID_FILE_NAME", message: "The file name is invalid." } },
      400,
    );
  }
  const csv = fileType === "text/csv" && fileName.toLowerCase().endsWith(".csv");
  const xlsx = fileType === xlsxMime && fileName.toLowerCase().endsWith(".xlsx");
  if (!csv && !xlsx) {
    return context.json(
      { error: { code: "UNSUPPORTED_FILE_TYPE", message: "Upload a CSV or XLSX spreadsheet." } },
      415,
    );
  }

  let table: string[][];
  try {
    const bytes = await file.arrayBuffer();
    table = csv
      ? parseCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
      : parseXlsx(bytes);
  } catch {
    return context.json(
      {
        error: {
          code: "INVALID_FILE",
          message: "The spreadsheet could not be read. Check its encoding and format.",
        },
      },
      400,
    );
  }
  if (table.length < 2 || table.length - 1 > maxImportRows) {
    return context.json(
      {
        error: {
          code: "INVALID_ROW_COUNT",
          message: "The file must contain between 1 and 500 data rows.",
        },
      },
      400,
    );
  }

  const headers = table[0].map((header) => header.trim());
  if (
    headers.length > 30 ||
    headers.some((header) => !header) ||
    new Set(headers).size !== headers.length
  ) {
    return context.json(
      { error: { code: "INVALID_HEADERS", message: "Use 1–30 unique, non-empty column headers." } },
      400,
    );
  }
  const parsedRows: ParsedRow[] = table.slice(1).map((cells, index) => ({
    row_number: index + 2,
    values: Object.fromEntries(
      headers.map((header, cellIndex) => [header, cells[cellIndex] ?? ""]),
    ),
  }));
  const mappingField = form.get("mapping");
  if (typeof mappingField !== "string") {
    return context.json({
      data: {
        requires_mapping: true,
        headers,
        sample_rows: parsedRows.slice(0, 5),
        total_rows: parsedRows.length,
      },
    });
  }

  let mapping: ColumnMapping;
  try {
    mapping = JSON.parse(mappingField) as ColumnMapping;
  } catch {
    return context.json(
      { error: { code: "VALIDATION_ERROR", message: "The column mapping is invalid." } },
      400,
    );
  }
  const required = [
    "holder_name",
    "broker_name",
    "depository_type",
    "masked_demat_identifier",
  ] as const;
  const allowedTargets = new Set([
    ...required,
    "broker_code",
    "masked_client_reference",
    "account_status",
    "notes",
  ]);
  if (
    !mapping ||
    typeof mapping !== "object" ||
    Object.keys(mapping).some((field) => !allowedTargets.has(field)) ||
    required.some(
      (field) => typeof mapping[field] !== "string" || !headers.includes(mapping[field]!),
    ) ||
    Object.values(mapping).some((header) => header !== undefined && !headers.includes(header))
  ) {
    return context.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Map every required field to a spreadsheet column.",
        },
      },
      400,
    );
  }

  const records = parsedRows.map(({ row_number, values }) => {
    const raw = Object.fromEntries(
      Object.entries(mapping).flatMap(([target, source]) =>
        source ? [[target, values[source] ?? ""]] : [],
      ),
    );
    return { row_number, raw, parsed: dematAccountSchema.safeParse(raw) };
  });
  const identifiers = records.flatMap(({ parsed }) =>
    parsed.success
      ? [
          {
            depository_type: parsed.data.depository_type,
            identifier: parsed.data.masked_demat_identifier.trim().toLowerCase(),
          },
        ]
      : [],
  );
  const existing = new Set<string>();
  const supabase = context.get("rlsSupabase");
  for (const depository of ["NSDL", "CDSL"] as const) {
    const ids = identifiers
      .filter((item) => item.depository_type === depository)
      .map((item) => item.identifier);
    if (!ids.length) continue;
    const { data, error } = await supabase
      .from("demat_accounts")
      .select("depository_type, masked_demat_identifier_normalized")
      .eq("user_id", context.get("authenticatedUser").id)
      .eq("depository_type", depository)
      .in("masked_demat_identifier_normalized", [...new Set(ids)]);
    if (error) throw error;
    for (const account of data ?? []) {
      existing.add(`${account.depository_type}:${account.masked_demat_identifier_normalized}`);
    }
  }

  const seen = new Set<string>();
  const previewRows: AccountImportPreviewRow[] = records.map(({ row_number, raw, parsed }) => {
    if (!parsed.success) {
      return {
        row_number,
        record: raw as AccountImportPreviewRow["record"],
        row_status: "invalid",
        errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        warnings: [],
      };
    }
    const record = parsed.data;
    const identity = `${record.depository_type}:${record.masked_demat_identifier.toLowerCase()}`;
    const errors: string[] = [];
    const warnings: string[] = [];
    if (seen.has(identity)) {
      warnings.push("Duplicate account in this file; this row will not be imported.");
    } else if (existing.has(identity)) {
      warnings.push("This account already exists; this row will not be imported.");
    }
    seen.add(identity);
    return {
      row_number,
      record: {
        ...record,
        broker_code: record.broker_code ?? null,
        masked_client_reference: record.masked_client_reference ?? null,
        notes: record.notes ?? null,
      },
      row_status: warnings.length ? "duplicate" : "ready",
      errors,
      warnings,
    };
  });

  const userId = context.get("authenticatedUser").id;
  const { data: importRecord, error: importError } = await supabase
    .from("account_imports")
    .insert({
      user_id: userId,
      file_name: fileName,
      file_type: fileType,
      total_rows: previewRows.length,
    })
    .select("id, file_name, file_type, status, total_rows, imported_rows, created_at")
    .single();
  if (importError) throw importError;
  const { error: rowsError } = await supabase.from("account_import_rows").insert(
    previewRows.map((row) => ({
      import_id: importRecord.id,
      row_number: row.row_number,
      record: row.record,
      row_status: row.row_status,
      errors: row.errors,
      warnings: row.warnings,
    })),
  );
  if (rowsError) {
    const { error: cleanupError } = await supabase
      .from("account_imports")
      .delete()
      .eq("id", importRecord.id)
      .eq("user_id", userId);
    if (cleanupError) throw cleanupError;
    throw rowsError;
  }

  return context.json({
    data: {
      import: importRecord,
      rows: previewRows,
      summary: {
        total: previewRows.length,
        ready: previewRows.filter((row) => row.row_status === "ready").length,
        duplicate: previewRows.filter((row) => row.row_status === "duplicate").length,
        invalid: previewRows.filter((row) => row.row_status === "invalid").length,
      },
    },
  });
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      if (rows.length > maxImportRows + 1) throw new Error("Too many rows.");
    } else if (character === '"') {
      throw new Error("Malformed CSV quoting.");
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  if (field || row.length || (input.length > 0 && !/[\r\n]$/.test(input))) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length && rows[0][0]?.startsWith("\uFEFF")) {
    rows[0][0] = rows[0][0].slice(1);
  }
  if (rows.length > maxImportRows + 1) throw new Error("Too many rows.");
  const width = Math.max(...rows.map((entry) => entry.length));
  if (width > 30) throw new Error("Too many columns.");
  return rows.map((entry) => [...entry, ...Array(Math.max(0, width - entry.length)).fill("")]);
}

function parseXlsx(bytes: ArrayBuffer): string[][] {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  if (workbook.SheetNames.length !== 1) throw new Error("Use a workbook with exactly one sheet.");
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Worksheet not found.");
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  if (range.e.r - range.s.r + 1 > maxImportRows + 1 || range.e.c - range.s.c + 1 > 30) {
    throw new Error("Spreadsheet exceeds the row or column limit.");
  }
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: true,
  });
  return rows.map((row) => row.map((cell) => String(cell ?? "")));
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function accountNotFound(context: AccountRouteContext) {
  return context.json(
    { error: { code: "ACCOUNT_NOT_FOUND", message: "The account was not found." } },
    404,
  );
}

function importNotFound(context: AccountRouteContext) {
  return context.json(
    { error: { code: "IMPORT_NOT_FOUND", message: "The import was not found." } },
    404,
  );
}

function databaseError(context: AccountRouteContext, error: { code?: string; message: string }) {
  if (error.code === "P0002" && error.message.includes("IMPORT_NOT_FOUND")) {
    return context.json(
      { error: { code: "IMPORT_NOT_FOUND", message: "The import was not found." } },
      404,
    );
  }
  if (error.code === "23514" && error.message.includes("ACTIVE_ACCOUNT_LIMIT")) {
    return context.json(
      {
        error: {
          code: "ACCOUNT_LIMIT_REACHED",
          message: "You can have up to 500 active accounts.",
        },
      },
      409,
    );
  }
  if (error.code === "23505") {
    return context.json(
      {
        error: { code: "DUPLICATE_ACCOUNT", message: "This demat account is already registered." },
      },
      409,
    );
  }
  if (error.code === "23514" && error.message.includes("IMPORT_REVERSAL_BLOCKED")) {
    return context.json(
      {
        error: {
          code: "IMPORT_REVERSAL_BLOCKED",
          message: "Some imported accounts changed and cannot be safely reversed.",
        },
      },
      409,
    );
  }
  if (error.code === "23514" && error.message.includes("IMPORT_NOT_REVERSIBLE")) {
    return context.json(
      {
        error: {
          code: "IMPORT_NOT_REVERSIBLE",
          message: "Only confirmed imports can be reversed.",
        },
      },
      409,
    );
  }
  throw error;
}

function parsePositiveInteger(value: string | undefined, defaultValue: number) {
  if (value === undefined) return defaultValue;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function hasControlCharacters(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

async function readJsonBody(context: AccountRouteContext): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return null;
  }
}
