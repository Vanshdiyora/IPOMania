import { expect, test, type Page } from "@playwright/test";
import { auditAccessibility } from "./accessibility";

const userId = "11111111-1111-4111-8111-111111111111";
const ipoId = "88888888-8888-4888-8888-888888888888";
const ipo = {
  id: ipoId,
  user_id: userId,
  company_name: "IPO Test Company",
  symbol: "IPOTEST",
  ipo_type: "Mainboard",
  exchange: "Test Exchange",
  issue_price_min: "10.00",
  issue_price_max: "20.00",
  cut_off_price: "20.00",
  lot_size: 10,
  issue_size: "100000.00",
  opening_date: "2026-11-01",
  closing_date: "2026-11-03",
  allotment_date: null,
  listing_date: null,
  status: "UPCOMING",
  data_source: "MANUAL",
  source_reference: null,
  last_verified_at: null,
  created_at: "2026-10-31T12:00:00.000Z",
  updated_at: "2026-10-31T12:00:00.000Z",
  archived_at: null,
};
const application = {
  id: "77777777-7777-4777-8777-777777777777",
  user_id: userId,
  ipo_id: ipoId,
  demat_account_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  category_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  lots: 2,
  total_shares: 20,
  application_amount: "400.00",
  application_number: "APP-2026-001",
  external_reference: null,
  submission_date: "2026-11-02T10:00:00.000Z",
  application_status: "SUBMITTED",
  mandate_status: "PENDING",
  allotment_status: "PENDING",
  notes: null,
  rule_version: 1,
  calculation_snapshot: {},
  created_at: "2026-11-02T10:00:00.000Z",
  updated_at: "2026-11-02T10:00:00.000Z",
  archived_at: null,
  demat_accounts: { holder_name: "Test Holder" },
  ipo_categories: { category: "RETAIL" },
};
const catalogIpo = {
  ...ipo,
  company_name: "Admin Catalog Test Company",
  data_source: "IPO_GURU",
  source_reference: "test-provider-id",
  symbol: null,
  issue_price_min: null,
  issue_price_max: null,
  opening_date: null,
  lot_size: null,
};

async function prepareAuthenticatedPage(page: Page) {
  await page.addInitScript(() => {
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      aud: "authenticated",
      role: "authenticated",
      email: "ipo@example.test",
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
  await page.route(/\/api\/ipos(?:\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ipos: [ipo],
          pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
        },
      }),
    }),
  );
  await page.route(/\/api\/ipos\/catalog(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        data: {
          ipos: [catalogIpo],
          pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
        },
      },
    }),
  );
  await page.route(`**/api/ipos/catalog/${ipoId}`, (route) =>
    route.fulfill({ json: { data: catalogIpo } }),
  );
  await page.route(`**/api/ipos/${ipoId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: ipo }),
    }),
  );
  await page.route(`**/api/ipos/${ipoId}/categories`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { configurations: [] } }),
    }),
  );
  await page.route(/\/api\/applications(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        data: {
          applications: [application],
          pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
        },
      },
    }),
  );
  await page.route(/\/api\/accounts(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        data: {
          accounts: [
            {
              id: application.demat_account_id,
              user_id: userId,
              holder_name: "Test Holder",
              account_status: "active",
              archived_at: null,
            },
          ],
          pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
        },
      },
    }),
  );
}

test("the user IPO page does not expose personal IPO or catalog creation controls", async ({
  page,
}) => {
  await prepareAuthenticatedPage(page);
  await page.goto("/ipos?source=personal");

  await expect(page).toHaveURL(/\/ipos$/);
  await expect(page.getByRole("heading", { name: "IPO catalog", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "My IPOs", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Add to catalog", exact: true })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Source" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "IPO Test Company", exact: true })).toHaveCount(0);
});

test("regular users see admin-managed IPOs by default and can open shared details", async ({
  page,
}) => {
  await prepareAuthenticatedPage(page);
  await page.goto("/ipos");
  await expect(page.getByRole("heading", { name: "IPO catalog", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "My IPOs", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Add to catalog", exact: true })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Source" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "IPO Test Company", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: catalogIpo.company_name }).click();
  await expect(page).toHaveURL(new RegExp(`/ipos/catalog/${ipoId}$`));
  await expect(page.getByRole("heading", { name: catalogIpo.company_name })).toBeVisible();
  await expect(page.getByText("Admin-managed", { exact: true })).toBeVisible();
  await expect(page.getByText("IPO Guru", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit IPO" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Configure categories" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Archive" })).toHaveCount(0);
  expect(await auditAccessibility(page)).toEqual([]);
});

test("catalog search and sorting reach the shared endpoint", async ({ page }) => {
  await prepareAuthenticatedPage(page);
  await page.goto("/ipos");
  const searched = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/ipos/catalog" && url.searchParams.get("search") === "Catalog";
  });
  await page.getByRole("textbox", { name: "Search company or exact symbol" }).fill("Catalog");
  await searched;
  const sorted = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/api/ipos/catalog" &&
      url.searchParams.get("sort") === "price_desc" &&
      url.searchParams.get("search") === "Catalog"
    );
  });
  await page.getByRole("combobox", { name: "Sort IPOs" }).click();
  await page.getByRole("option", { name: "Price · high to low" }).click();
  await sorted;
  const filtered = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/ipos/catalog" && url.searchParams.get("status") === "OPEN";
  });
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await filtered;
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page).toHaveURL(/\/ipos\?search=Catalog&sort=price_desc$/);
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("link", { name: catalogIpo.company_name })).toBeVisible();
  await page.getByRole("link", { name: catalogIpo.company_name }).click();
  await page.getByRole("link", { name: "Back to IPOs" }).click();
  await expect(page).toHaveURL(/\/ipos\?search=Catalog&sort=price_desc$/);
  await expect(page.getByRole("textbox", { name: "Search company or exact symbol" })).toHaveValue(
    "Catalog",
  );
  await expect(page.getByRole("combobox", { name: "Sort IPOs" })).toHaveText("Price · high to low");
});

test("a direct catalog detail link returns to the catalog", async ({ page }) => {
  await prepareAuthenticatedPage(page);
  await page.goto(`/ipos/catalog/${ipoId}`);
  await page.getByRole("link", { name: "Back to IPOs" }).click();
  await expect(page).toHaveURL(/\/ipos$/);
});

test("the legacy IPO calendar URL redirects to the IPO list", async ({ page }) => {
  await prepareAuthenticatedPage(page);
  await page.goto("/ipo-calendar?source=personal");
  await expect(page).toHaveURL(/\/ipos$/);
  await expect(page.getByRole("heading", { name: "IPO catalog", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /calendar/i })).toHaveCount(0);
});

test("browser back restores the previous catalog sort", async ({ page }) => {
  await prepareAuthenticatedPage(page);
  await page.goto("/ipos?sort=date_asc");
  await page.goto("/ipos?sort=date_desc");
  await page.goBack();
  await expect(page.getByRole("combobox", { name: "Sort IPOs" })).toHaveText("Date · oldest first");
  await expect(page.getByRole("link", { name: catalogIpo.company_name })).toBeVisible();
});

test("IPO list passes automated WCAG 2.2 AA checks", async ({ page }) => {
  await prepareAuthenticatedPage(page);
  await page.goto("/ipos");
  expect(await auditAccessibility(page)).toEqual([]);
});

test("category configuration keeps unknown rules explicit", async ({ page }) => {
  await prepareAuthenticatedPage(page);
  await page.goto(`/ipos/${ipoId}/categories`);

  await expect(page.getByRole("heading", { name: "Category configuration" })).toBeVisible();
  await expect(page.getByText(/Unknown limits stay unconfigured/)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Lot limits" })).toContainText("Unconfigured");
  await expect(page.getByLabel("Lot increment")).toHaveValue("");
});
