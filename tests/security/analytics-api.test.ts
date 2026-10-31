import * as XLSX from "@e965/xlsx";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../workers/api/src/app";

const userId = "11111111-1111-4111-8111-111111111111";
const ipoId = "22222222-2222-4222-8222-222222222222";
const accountId = "33333333-3333-4333-8333-333333333333";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "analytics-owner@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};
const bindings = {
  RUNTIME_ENV: "test",
  SUPABASE_URL: "https://project.example.test",
  SUPABASE_ANON_KEY: "public-anon-key-for-tests",
} as const;
const analytics = {
  totals: { applications: 1, active_demat_accounts: 2, tracked_ipos: 3 },
  applications_by_status: [{ status: "SUBMITTED", count: 1 }],
  applications_by_ipo: [
    {
      ipo_id: ipoId,
      company_name: "=Formula",
      symbol: "FORMULA",
      count: 1,
    },
  ],
  applications_by_category: [{ category: "RETAIL", count: 1 }],
  applications_by_account: [],
  applications_by_broker: [],
  monthly_application_trends: [],
  capital_utilization_trends: [],
  capital_event_totals: [
    {
      currency: "INR",
      capital_blocked: "123456789012345678901234.567891",
      actual_debit: "0",
      refund_received: "0",
      capital_block_events: 1,
      actual_debit_events: 0,
      refund_receipt_events: 0,
      listing_sales: 0,
      listing_price_updates: 0,
    },
  ],
  allotment_performance: {
    total: 0,
    successful: 0,
    success_rate_percent: null,
    full: 0,
    partial: 0,
    none: 0,
  },
  refund_performance: {
    total: 0,
    pending: 0,
    completed: 0,
    pending_expected_amount: "0",
    completed_expected_amount: "0",
  },
  recent_applications: [],
  upcoming_ipos: [],
};

afterEach(() => vi.unstubAllGlobals());

function installMock(restResponse = JSON.stringify(analytics)) {
  const requests: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      if (new URL(request.url).pathname.endsWith("/auth/v1/user")) {
        return new Response(JSON.stringify(user), {
          headers: { "Content-Type": "application/json" },
        });
      }
      requests.push(request.clone());
      return new Response(restResponse, {
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return requests;
}

function authHeaders() {
  return { Authorization: "Bearer test-access-token" };
}

describe("dashboard analytics API", () => {
  it("uses the caller JWT, validates filters, and never accepts a user ID", async () => {
    const requests = installMock();
    const response = await createApp().request(
      `/api/analytics?date_from=2026-10-01&date_to=2026-10-31&ipo_id=${ipoId}&category=RETAIL&account_id=${accountId}&limit=7`,
      { headers: authHeaders() },
      bindings,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: analytics });
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0]!.url).pathname).toContain("/rpc/get_dashboard_analytics");
    expect(requests[0]!.headers.get("authorization")).toBe("Bearer test-access-token");
    await expect(requests[0]!.json()).resolves.toEqual({
      p_date_from: "2026-10-01",
      p_date_to: "2026-10-31",
      p_ipo_id: ipoId,
      p_category: "RETAIL",
      p_account_id: accountId,
      p_limit: 7,
    });

    const invalid = await createApp().request(
      `/api/analytics?ipo_id=${ipoId}&user_id=${userId}`,
      { headers: authHeaders() },
      bindings,
    );
    expect(invalid.status).toBe(400);
    expect(requests).toHaveLength(1);
  });

  it("requires authentication and reports an empty result without fabricating totals", async () => {
    const requests = installMock();
    const unauthenticated = await createApp().request("/api/analytics", {}, bindings);
    expect(unauthenticated.status).toBe(401);
    expect(requests).toHaveLength(0);

    const emptyResult = {
      ...analytics,
      totals: { applications: 0, active_demat_accounts: 0, tracked_ipos: 0 },
      allotment_performance: {
        ...analytics.allotment_performance,
        success_rate_percent: null,
      },
    };
    const emptyRequests = installMock(JSON.stringify(emptyResult));
    const empty = await createApp().request(
      "/api/analytics?date_from=2026-10-01&date_to=2026-10-31",
      { headers: authHeaders() },
      bindings,
    );
    expect(empty.status).toBe(200);
    await expect(empty.json()).resolves.toMatchObject({
      data: { totals: { applications: 0 }, allotment_performance: { success_rate_percent: null } },
    });
    expect(emptyRequests).toHaveLength(1);
  });

  it("exports exact decimal strings and formula-safe CSV", async () => {
    installMock();
    const response = await createApp().request(
      "/api/analytics/export?format=csv",
      { headers: { ...authHeaders(), Origin: "http://127.0.0.1:4175" } },
      bindings,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("access-control-expose-headers")).toContain("Content-Disposition");
    const csv = await response.text();
    expect(csv).toContain("'=Formula");
    expect(csv).toContain("123456789012345678901234.567891");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("exports a multi-sheet Excel workbook with empty metrics marked unavailable", async () => {
    installMock();
    const response = await createApp().request(
      "/api/analytics/export?format=xlsx",
      { headers: authHeaders() },
      bindings,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const workbook = XLSX.read(await response.arrayBuffer(), { type: "array" });
    expect(workbook.SheetNames).toContain("Summary");
    expect(workbook.SheetNames).toContain("Capital utilization");
    const summary = XLSX.utils.sheet_to_json(workbook.Sheets.Summary);
    expect(summary).toContainEqual({ metric: "Allotment success rate (%)", value: "Unavailable" });
    const ipoRows = XLSX.utils.sheet_to_json(workbook.Sheets.IPO) as Array<{
      company_name: string;
      count: number;
    }>;
    expect(ipoRows[0]?.company_name).toBe("'=Formula");
    expect(ipoRows[0]?.count).toBe(1);
    const capitalRows = XLSX.utils.sheet_to_json(workbook.Sheets["Capital totals"]) as Array<{
      capital_blocked: string;
    }>;
    expect(capitalRows[0]?.capital_blocked).toBe("123456789012345678901234.567891");
  });
});
