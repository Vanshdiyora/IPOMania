import { expect, test, type Page } from "@playwright/test";

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
  await page.route("**/api/ipos?*", (route) =>
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
}

test("IPO list and details show user-entered provenance and rule setup links", async ({ page }) => {
  await prepareAuthenticatedPage(page);
  await page.goto("/ipos");

  await expect(page.getByRole("heading", { name: "IPOs", exact: true })).toBeVisible();
  await expect(page.getByText("Manual entry · unverified")).toBeVisible();
  await page.getByRole("link", { name: "IPO Test Company" }).click();

  await expect(page.getByRole("heading", { name: "IPO Test Company" })).toBeVisible();
  await expect(
    page.getByText(/The application does not automatically fetch or verify the source/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Configure categories" })).toBeVisible();
  await expect(page.getByText("Rules not configured").first()).toBeVisible();
});

test("category configuration keeps unknown rules explicit", async ({ page }) => {
  await prepareAuthenticatedPage(page);
  await page.goto(`/ipos/${ipoId}/categories`);

  await expect(page.getByRole("heading", { name: "Category configuration" })).toBeVisible();
  await expect(page.getByText(/Unknown limits stay unconfigured/)).toBeVisible();
  await expect(page.getByLabel("Lot limits")).toHaveValue("UNCONFIGURED");
  await expect(page.getByLabel("Lot increment")).toHaveValue("");
});
