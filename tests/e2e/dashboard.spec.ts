import { expect, test, type Page } from "@playwright/test";
import { auditAccessibility } from "./accessibility";

const ipoId = "88888888-8888-4888-8888-888888888888";
const accountId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const applicationId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const dashboardData = {
  totals: { applications: 1, active_demat_accounts: 1, tracked_ipos: 1 },
  applications_by_status: [
    { status: "SUBMITTED", count: 1 },
    { status: "DRAFT", count: 0 },
    { status: "UNDER_PROCESSING", count: 0 },
    { status: "REJECTED", count: 0 },
    { status: "FAILED", count: 0 },
    { status: "COMPLETED", count: 0 },
  ],
  applications_by_ipo: [
    {
      ipo_id: ipoId,
      company_name: "Dashboard Test IPO",
      symbol: "DASH",
      count: 1,
    },
  ],
  applications_by_category: [
    { category: "RETAIL", count: 1 },
    { category: "SHNI", count: 0 },
    { category: "BHNI", count: 0 },
    { category: "SHAREHOLDER", count: 0 },
  ],
  applications_by_account: [
    {
      account_id: accountId,
      holder_name: "Dashboard Holder",
      masked_demat_identifier: "XXXX1234",
      broker_name: "Dashboard Broker",
      count: 1,
    },
  ],
  applications_by_broker: [{ broker_name: "Dashboard Broker", count: 1 }],
  monthly_application_trends: [{ month: "2026-10", count: 1 }],
  capital_utilization_trends: [
    {
      month: "2026-10",
      currency: "INR",
      capital_blocked: "2500",
      capital_released: "0",
      actual_debit: "0",
      refund_received: "0",
      listing_sales: 0,
      listing_price_updates: 0,
    },
  ],
  capital_event_totals: [
    {
      currency: "INR",
      capital_blocked: "2500",
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
  recent_applications: [
    {
      application_id: applicationId,
      ipo_id: ipoId,
      company_name: "Dashboard Test IPO",
      symbol: "DASH",
      account_id: accountId,
      holder_name: "Dashboard Holder",
      masked_demat_identifier: "XXXX1234",
      category: "RETAIL",
      status: "SUBMITTED",
      created_at: "2026-10-31T12:00:00.000Z",
    },
  ],
  upcoming_ipos: [
    {
      ipo_id: ipoId,
      company_name: "Dashboard Test IPO",
      symbol: "DASH",
      status: "UPCOMING",
      closing_date: "2099-12-31",
      data_source: "MANUAL",
    },
  ],
};

async function prepareDashboard(page: Page) {
  await page.addInitScript(() => {
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      aud: "authenticated",
      role: "authenticated",
      email: "dashboard@example.test",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const payload = btoa(
      JSON.stringify({
        sub: user.id,
        aud: "authenticated",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    )
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
    localStorage.setItem(
      "sb-127-auth-token",
      JSON.stringify({
        access_token: `${payload}.signature`,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "test-refresh-token",
        user,
      }),
    );
  });
  await page.route(/\/api\/analytics\/export(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/csv",
      headers: { "Content-Disposition": 'attachment; filename="analytics.csv"' },
      body: "section,label,count,amount\n",
    }),
  );
  await page.route(/\/api\/analytics(?:\?.*)?$/, (route) =>
    route.fulfill({ json: { data: dashboardData } }),
  );
  await page.route(/\/api\/capital\/summary(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        data: {
          summaries: [
            {
              currency: "INR",
              total_application_value: "2500.125",
              approved_mandate_value: "0",
              currently_blocked_capital: "2500",
              released_capital: "0",
              actually_invested_capital: "0",
              refunds_received: "0",
              outstanding_refunds: "0",
              realized_pnl: "0",
              unrealized_pnl: null,
            },
          ],
        },
      },
    }),
  );
  await page.route(/\/api\/ipos(?:\/catalog)?(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: { data: { ipos: [{ id: ipoId, company_name: "Dashboard Test IPO", symbol: "DASH" }] } },
    }),
  );
  await page.route("**/api/accounts?*", (route) =>
    route.fulfill({
      json: {
        data: {
          accounts: [
            { id: accountId, holder_name: "Dashboard Holder", masked_demat_identifier: "XXXX1234" },
          ],
        },
      },
    }),
  );
}

test("dashboard exposes analytics, filters and downloadable reports", async ({ page }) => {
  await prepareDashboard(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Dashboard & analytics" })).toBeVisible();
  await expect(page.getByText("INR 2,500", { exact: true })).toBeVisible();
  await expect(page.getByText("Unavailable").first()).toBeVisible();
  await expect(page.getByRole("img", { name: "Applications grouped by status" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard Test IPO (DASH)" }).first()).toBeVisible();
  expect(await auditAccessibility(page)).toEqual([]);

  const downloadWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadWait;
  expect(download.suggestedFilename()).toBe("analytics.csv");

  await page.getByLabel("Category filter").selectOption("RETAIL");
  await expect(page.getByLabel("Category filter")).toHaveValue("RETAIL");
});

test("dashboard remains usable across responsive viewports with accessible filters", async ({
  page,
}, testInfo) => {
  await prepareDashboard(page);
  await page.goto("/");

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 375, height: 812 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("heading", { name: "Dashboard & analytics" })).toBeVisible();
    await expect(page.getByLabel("From date")).toBeVisible();
    await expect(page.getByLabel("To date")).toBeVisible();
    await expect(page.getByLabel("IPO filter")).toBeVisible();
    await expect(page.getByLabel("Category filter")).toBeVisible();
    await expect(page.getByLabel("Demat account filter")).toBeVisible();
    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
    await testInfo.attach(`dashboard-${viewport.width}.png`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  }
});

test("dashboard marks aggregate metrics unavailable when analytics fails", async ({ page }) => {
  await prepareDashboard(page);
  await page.unroute(/\/api\/analytics(?:\?.*)?$/);
  await page.route(/\/api\/analytics(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Analytics unavailable" } }),
    }),
  );
  await page.goto("/");

  await expect(page.getByRole("alert").filter({ hasText: "Analytics unavailable" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Dashboard totals" }).getByText("Unavailable").first(),
  ).toBeVisible();
});
