import * as XLSX from "@e965/xlsx";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../workers/api/src/app";

const userId = "11111111-1111-4111-8111-111111111111";
const importId = "55555555-5555-4555-8555-555555555555";
const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const bindings = {
  RUNTIME_ENV: "test",
  SUPABASE_URL: "https://project.example.test",
  SUPABASE_ANON_KEY: "public-anon-key-for-tests",
} as const;
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "account-owner@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};
const mapping = {
  holder_name: "Holder",
  bank_name: "Bank",
  username: "Username",
};

afterEach(() => vi.unstubAllGlobals());

function installImportMock() {
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
      if (url.pathname.endsWith("/demat_accounts")) {
        return new Response("[]", {
          headers: { "Content-Type": "application/json", "Content-Range": "*/0" },
        });
      }
      if (url.pathname.endsWith("/account_imports") && request.method === "POST") {
        return new Response(
          JSON.stringify({
            id: importId,
            file_name: "accounts.csv",
            file_type: "text/csv",
            status: "preview",
            total_rows: 2,
            imported_rows: 0,
            created_at: "2026-01-01T00:00:00.000Z",
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.pathname.endsWith("/account_import_rows") && request.method === "POST") {
        return new Response(null, { status: 201 });
      }
      return new Response("[]", { headers: { "Content-Type": "application/json" } });
    }),
  );
  return requests;
}

function fileForm(file: Blob, fileName: string, columns?: Record<string, string>) {
  const form = new FormData();
  form.append("file", file, fileName);
  if (columns) form.append("mapping", JSON.stringify(columns));
  return form;
}

function xlsxFile() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Holder", "Bank", "Username"],
    ["Asha Mehta", "Example Bank", "asha"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Accounts");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([bytes], { type: xlsxMime });
}

describe("account import API", () => {
  it("paginates import history with the shared page-size options", async () => {
    const requests = installImportMock();
    const response = await createApp().request(
      "/api/accounts/import/history?page=2&pageSize=50",
      { headers: { Authorization: "Bearer test-token" } },
      bindings,
    );

    expect(response.status, await response.clone().text()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        imports: [],
        pagination: { page: 2, pageSize: 50, total: 0, totalPages: 1 },
      },
    });
    const importRequest = requests.find((request) =>
      new URL(request.url).pathname.endsWith("/account_imports"),
    );
    expect(new URL(importRequest!.url).searchParams.get("offset")).toBe("50");
    expect(new URL(importRequest!.url).searchParams.get("limit")).toBe("50");

    const invalid = await createApp().request(
      "/api/accounts/import/history?pageSize=20",
      { headers: { Authorization: "Bearer test-token" } },
      bindings,
    );
    expect(invalid.status).toBe(400);
  });

  it("reads CSV columns before requiring the user to map them", async () => {
    installImportMock();
    const csv = new Blob(["Holder,Bank,Username\r\nAsha Mehta,Example Bank,asha\r\n"], {
      type: "text/csv",
    });
    const response = await createApp().request(
      "/api/accounts/import/preview",
      {
        method: "POST",
        headers: { Authorization: "Bearer caller-token" },
        body: fileForm(csv, "accounts.csv"),
      },
      bindings,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        requires_mapping: true,
        headers: ["Holder", "Bank", "Username"],
        total_rows: 1,
      },
    });
  });

  it("rejects password columns without echoing or staging credential data", async () => {
    const requests = installImportMock();
    const csv = new Blob(
      ["Holder,Bank,Username,Password\r\nAsha Mehta,Example Bank,asha,secret-value\r\n"],
      { type: "text/csv" },
    );
    const response = await createApp().request(
      "/api/accounts/import/preview",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-access-token" },
        body: fileForm(csv, "accounts.csv"),
      },
      bindings,
    );

    const responseText = await response.text();
    expect(response.status, responseText).toBe(400);
    expect(responseText).not.toContain("secret-value");
    expect(requests).toHaveLength(0);
  });

  it("validates CSV rows and reports duplicates and invalid values instead of dropping them", async () => {
    const requests = installImportMock();
    const csv = new Blob(
      [
        "Holder,Bank,Username\r\n" +
          "Asha Mehta,Example Bank,asha\r\n" +
          "Duplicate,Example Bank,asha\r\n" +
          "Invalid,Example Bank,\r\n",
      ],
      { type: "text/csv" },
    );
    const response = await createApp().request(
      "/api/accounts/import/preview",
      {
        method: "POST",
        headers: { Authorization: "Bearer caller-token" },
        body: fileForm(csv, "accounts.csv", mapping),
      },
      bindings,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        rows: Array<{ row_status: string; warnings: string[] }>;
        summary: Record<string, number>;
      };
    };
    expect(body.data.rows.map((row) => row.row_status)).toEqual(["ready", "duplicate", "invalid"]);
    expect(body.data.rows[1].warnings).toContain(
      "Duplicate account in this file; this row will not be imported.",
    );
    expect(body.data.summary).toMatchObject({ total: 3, ready: 1, duplicate: 1, invalid: 1 });
    const staged = requests.find((request) =>
      new URL(request.url).pathname.endsWith("/account_import_rows"),
    );
    expect(staged).toBeDefined();
    const stagedRows = (await staged!.json()) as Array<{ row_number: number }>;
    expect(stagedRows).toHaveLength(3);
  });

  it("parses a real XLSX workbook and stores its valid row for preview", async () => {
    installImportMock();
    const response = await createApp().request(
      "/api/accounts/import/preview",
      {
        method: "POST",
        headers: { Authorization: "Bearer caller-token" },
        body: fileForm(xlsxFile(), "accounts.xlsx", mapping),
      },
      bindings,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { summary: { total: 1, ready: 1, duplicate: 0, invalid: 0 } },
    });
  });

  it("rejects a mismatched file content type", async () => {
    installImportMock();
    const response = await createApp().request(
      "/api/accounts/import/preview",
      {
        method: "POST",
        headers: { Authorization: "Bearer caller-token" },
        body: fileForm(
          new Blob(["not a spreadsheet"], { type: "application/octet-stream" }),
          "accounts.csv",
        ),
      },
      bindings,
    );

    expect(response.status).toBe(415);
  });

  it("rejects uploads larger than the configured size limit", async () => {
    const requests = installImportMock();
    const oversizedCsv = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], {
      type: "text/csv",
    });
    const response = await createApp().request(
      "/api/accounts/import/preview",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-user-token" },
        body: fileForm(oversizedCsv, "accounts.csv"),
      },
      bindings,
    );

    expect(response.status).toBe(413);
    expect(requests).toHaveLength(0);
  });
});
