import * as XLSX from "@e965/xlsx";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../workers/api/src/app";

const userId = "11111111-1111-4111-8111-111111111111";
const ipoId = "88888888-8888-4888-8888-888888888888";
const accountId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const importId = "55555555-5555-4555-8555-555555555555";
const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "application-owner@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};
const bindings = {
  RUNTIME_ENV: "test",
  SUPABASE_URL: "https://project.example.test",
  SUPABASE_ANON_KEY: "public-anon-key-for-tests",
} as const;
const ipo = {
  id: ipoId,
  symbol: "TEST",
  company_name: "Test IPO",
  issue_price_min: "10.00",
  issue_price_max: "20.00",
  cut_off_price: "20.00",
  lot_size: 10,
  archived_at: null,
};
const account = {
  id: accountId,
  account_status: "active",
  archived_at: null,
  masked_demat_identifier: "XXXX1234",
  masked_client_reference: null,
};
const category = {
  id: categoryId,
  ipo_id: ipoId,
  category: "RETAIL",
  rule_version: 3,
  lot_limit_status: "CONFIGURED",
  minimum_lots: 1,
  maximum_lots: 2,
  lot_increment: 1,
  investment_limit_status: "NO_PUBLISHED_LIMIT",
  minimum_investment: null,
  maximum_investment: null,
  shareholder_record_date: null,
  minimum_shareholding: null,
  eligibility_conditions: [],
  allowed_price_types: ["CUT_OFF", "BID"],
  minimum_price_increment: "0.05",
};
const applicationInput = {
  ipo_id: ipoId,
  demat_account_id: accountId,
  category_id: categoryId,
  lots: 1,
  price_type: "CUT_OFF",
  price: "20.00",
  shareholder_shares: null,
  eligibility_answers: {},
};

afterEach(() => vi.unstubAllGlobals());

function installMock(
  options: {
    account?: typeof account | null;
    category?: typeof category;
    duplicate?: boolean;
    exportRows?: boolean;
  } = {},
) {
  const requests: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);
      if (url.pathname.endsWith("/auth/v1/user")) {
        return new Response(JSON.stringify(user), {
          headers: { "Content-Type": "application/json" },
        });
      }
      requests.push(request.clone());
      const table = url.pathname.split("/").pop();
      if (table === "ipos") {
        return json(request.method === "GET" ? [ipo] : []);
      }
      if (table === "demat_accounts") {
        return json(options.account === null ? [] : [options.account ?? account]);
      }
      if (table === "ipo_categories") return json([options.category ?? category]);
      if (table === "applications") {
        if (request.method === "POST") {
          const record = await request.json();
          return json(record, 201);
        }
        if (options.exportRows) {
          return new Response(
            JSON.stringify([
              {
                id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
                user_id: userId,
                ipo_id: ipoId,
                demat_account_id: accountId,
                category_id: categoryId,
                lots: 1,
                total_shares: 5,
                application_amount: "100.50",
                application_number: "APP-1",
                external_reference: "=SUM(1,1)",
                submission_date: null,
                application_status: "DRAFT",
                mandate_status: "UNKNOWN",
                allotment_status: "UNKNOWN",
                notes: null,
                rule_version: 3,
                calculation_snapshot: {},
                created_at: "2026-10-31T00:00:00.000Z",
                updated_at: "2026-10-31T00:00:00.000Z",
                archived_at: null,
                ipos: { symbol: "TEST", company_name: "Test IPO" },
                demat_accounts: { masked_demat_identifier: "XXXX1234", broker_name: "Test Broker" },
                ipo_categories: { category: "RETAIL" },
              },
            ]),
            {
              headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
            },
          );
        }
        return new Response(
          JSON.stringify(options.duplicate ? [{ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }] : []),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Content-Range": options.duplicate ? "0-0/1" : "*/0",
            },
            ...(options.duplicate ? { statusText: "OK" } : {}),
          },
        );
      }
      if (table === "application_imports" && request.method === "POST") {
        return json({
          id: importId,
          file_name: "applications.csv",
          file_type: "text/csv",
          status: "preview",
          total_rows: 1,
          imported_rows: 0,
          created_at: "2026-10-31T00:00:00.000Z",
        });
      }
      if (table === "application_import_rows") return new Response(null, { status: 201 });
      return json([]);
    }),
  );
  return requests;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function csvFile(fileType = "text/csv") {
  return new Blob(
    ["IPO,Account,Category,Lots,Price,Price Type\nTEST,XXXX1234,RETAIL,1,20.00,CUT_OFF\n"],
    { type: fileType },
  );
}

function xlsxFile() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["IPO", "Account", "Category", "Lots", "Price", "Price Type"],
      ["TEST", "XXXX1234", "RETAIL", "1", "20.00", "CUT_OFF"],
    ]),
    "Applications",
  );
  return new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], {
    type: xlsxMime,
  });
}

function form(file: Blob, name: string, mapping?: Record<string, string>) {
  const body = new FormData();
  body.append("file", file, name);
  if (mapping) body.append("mapping", JSON.stringify(mapping));
  return body;
}

describe("application API", () => {
  it("creates an owned application with exact amount and an immutable calculation snapshot", async () => {
    const requests = installMock();
    const response = await createApp().request(
      "/api/applications",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
        body: JSON.stringify(applicationInput),
      },
      bindings,
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({
      user_id: userId,
      application_amount: "200",
      total_shares: 10,
      rule_version: 3,
      application_status: "DRAFT",
      mandate_status: "UNKNOWN",
    });
    expect(body.data.calculation_snapshot).toBeDefined();
    const insert = requests.find(
      (request) =>
        new URL(request.url).pathname.endsWith("/applications") && request.method === "POST",
    );
    expect(insert).toBeDefined();
    expect(await insert!.json()).toMatchObject({ user_id: userId });
  });

  it("rejects an inactive or unowned account before inserting", async () => {
    const requests = installMock({ account: null });
    const response = await createApp().request(
      "/api/applications",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
        body: JSON.stringify(applicationInput),
      },
      bindings,
    );
    expect(response.status).toBe(422);
    expect(requests.some((request) => request.method === "POST")).toBe(false);
  });

  it("creates applications only for categories with matching issue-specific rules", async () => {
    for (const code of ["RETAIL", "SHNI", "BHNI", "SHAREHOLDER"] as const) {
      const configuredCategory = {
        ...category,
        category: code,
        shareholder_record_date: code === "SHAREHOLDER" ? "2026-10-15" : null,
        minimum_shareholding: code === "SHAREHOLDER" ? 1 : null,
      };
      installMock({ category: configuredCategory });
      const response = await createApp().request(
        "/api/applications",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer application-test-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...applicationInput,
            shareholder_shares: code === "SHAREHOLDER" ? 1 : null,
          }),
        },
        bindings,
      );
      const responseBody = await response.text();
      expect(response.status, `category ${code}: ${responseBody}`).toBe(201);
    }
  });

  it("creates a bulk batch only after each submitted account passes validation", async () => {
    const requests = installMock();
    const response = await createApp().request(
      "/api/applications/bulk",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
        body: JSON.stringify({
          applications: [applicationInput, { ...applicationInput, lots: 2 }],
        }),
      },
      bindings,
    );
    expect(response.status).toBe(201);
    const insert = requests.find(
      (request) =>
        new URL(request.url).pathname.endsWith("/applications") && request.method === "POST",
    );
    expect(await insert?.json()).toHaveLength(2);
  });

  it("warns about a potential duplicate without prohibiting a legitimate application", async () => {
    installMock({ duplicate: true });
    const response = await createApp().request(
      "/api/applications",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
        body: JSON.stringify(applicationInput),
      },
      bindings,
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      warnings: [
        "A matching IPO, account, category, or reference already exists; review before confirming.",
      ],
    });
  });

  it("previews CSV mappings and never promotes imported rows to submitted automatically", async () => {
    installMock();
    const mapping = {
      ipo: "IPO",
      demat_account: "Account",
      category: "Category",
      lots: "Lots",
      price: "Price",
      price_type: "Price Type",
    };
    const response = await createApp().request(
      "/api/imports/preview",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
        body: form(csvFile(), "applications.csv", mapping),
      },
      bindings,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        rows: Array<{ row_status: string; warnings: string[]; record: Record<string, unknown> }>;
      };
    };
    expect(body.data.rows[0]?.row_status).toBe("ready");
    expect(body.data.rows[0]?.record.application_status).toBe("DRAFT");
    expect(body.data.rows[0]?.warnings).toContain(
      "Imported rows default to DRAFT; import does not imply submission.",
    );
  });

  it("parses XLSX workbooks and reports unmapped headers before staging", async () => {
    installMock();
    const response = await createApp().request(
      "/api/imports/preview",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
        body: form(xlsxFile(), "applications.xlsx"),
      },
      bindings,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        requires_mapping: true,
        headers: ["IPO", "Account", "Category", "Lots", "Price", "Price Type"],
      },
    });
  });

  it("maps and validates XLSX application rows", async () => {
    installMock();
    const mapping = {
      ipo: "IPO",
      demat_account: "Account",
      category: "Category",
      lots: "Lots",
      price: "Price",
      price_type: "Price Type",
    };
    const response = await createApp().request(
      "/api/imports/preview",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
        body: form(xlsxFile(), "applications.xlsx", mapping),
      },
      bindings,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { summary: { total: 1, ready: 1, invalid: 0 } },
    });
  });

  it("retains row-level errors while processing a full 500-row CSV batch", async () => {
    installMock();
    const rows = Array.from(
      { length: 500 },
      (_, index) =>
        `${index === 0 ? "UNKNOWN" : "TEST"},XXXX1234,RETAIL,1,20.00,CUT_OFF,APP-${index}`,
    );
    const csv = new Blob(
      [`IPO,Account,Category,Lots,Price,Price Type,Application Number\n${rows.join("\n")}\n`],
      { type: "text/csv" },
    );
    const mapping = {
      ipo: "IPO",
      demat_account: "Account",
      category: "Category",
      lots: "Lots",
      price: "Price",
      price_type: "Price Type",
      application_number: "Application Number",
    };
    const response = await createApp().request(
      "/api/imports/preview",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
        body: form(csv, "applications.csv", mapping),
      },
      bindings,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { summary: { total: 500, ready: 499, invalid: 1 } },
    });
  });

  it("exports the filtered financial fields and neutralizes spreadsheet formulas", async () => {
    installMock({ exportRows: true });
    const response = await createApp().request(
      "/api/applications/export",
      { headers: { Authorization: "Bearer test-token" } },
      bindings,
    );
    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain('"APP-1"');
    expect(csv).toContain('"100.50"');
    expect(csv).toContain('"\'=SUM(1,1)"');
  });

  it("rejects a second mapping that reuses a stable external reference in the same file", async () => {
    const requests = installMock();
    const body = new FormData();
    body.append(
      "file",
      new Blob(
        [
          "IPO,Account,Category,Lots,Price,Price Type,External\nTEST,XXXX1234,RETAIL,1,20.00,CUT_OFF,source-1\nTEST,XXXX1234,RETAIL,1,20.00,CUT_OFF,source-1\n",
        ],
        { type: "text/csv" },
      ),
      "applications.csv",
    );
    body.append(
      "mapping",
      JSON.stringify({
        ipo: "IPO",
        demat_account: "Account",
        category: "Category",
        lots: "Lots",
        price: "Price",
        price_type: "Price Type",
        external_reference: "External",
      }),
    );
    const response = await createApp().request(
      "/api/imports/preview",
      { method: "POST", headers: { Authorization: "Bearer test-token" }, body },
      bindings,
    );
    expect(response.status).toBe(200);
    const result = (await response.json()) as { data: { rows: Array<{ row_status: string }> } };
    expect(result.data.rows.map((row) => row.row_status)).toEqual(["ready", "invalid"]);
    expect(
      requests.some((request) =>
        new URL(request.url).pathname.endsWith("/application_import_rows"),
      ),
    ).toBe(true);
  });
});
