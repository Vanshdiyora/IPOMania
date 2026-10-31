import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { width: 320, height: 720 },
  { width: 375, height: 812 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

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

async function seedAuthenticatedUser(page: Page) {
  await page.addInitScript(() => {
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      aud: "authenticated",
      role: "authenticated",
      email: "responsive@example.test",
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
      json: {
        data: {
          ipos: [ipo],
          pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
        },
      },
    }),
  );
  await page.route(`**/api/ipos/${ipoId}`, (route) => route.fulfill({ json: { data: ipo } }));
  await page.route(`**/api/ipos/${ipoId}/categories`, (route) =>
    route.fulfill({ json: { data: { configurations: [] } } }),
  );
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
}

for (const viewport of viewports) {
  test(`landing and registration layouts fit at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome to IPO Mania" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await testInfo.attach(`landing-${viewport.width}.png`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });

    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await testInfo.attach(`registration-${viewport.width}.png`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  });

  test(`IPO list and details fit at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await seedAuthenticatedUser(page);
    await page.goto("/ipos");
    await expect(page.getByRole("heading", { name: "IPOs", exact: true })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Search company or exact symbol" }),
    ).toBeVisible();
    await expect(page.getByLabel("Status")).toBeVisible();
    await page.getByRole("textbox", { name: "Search company or exact symbol" }).fill("IPO Test");
    await expect(page.getByRole("link", { name: "IPO Test Company" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await testInfo.attach(`ipo-list-${viewport.width}.png`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });

    await page.getByRole("link", { name: "IPO Test Company" }).click();
    await expect(page.getByRole("heading", { name: "IPO Test Company" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await testInfo.attach(`ipo-details-${viewport.width}.png`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
  });
}

for (const viewport of viewports.filter(({ width }) => width < 768)) {
  test(`mobile navigation is accessible at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const menuButton = page.getByRole("button", { name: "Open navigation" });
    await expect(menuButton).toBeVisible();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
    await menuButton.click();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
    await expect(
      page.getByRole("complementary").getByRole("button", { name: "Close navigation" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Main navigation" })).not.toBeVisible();

    await page.getByRole("button", { name: "Open navigation" }).click();
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", {
        name: "Sign in",
      })
      .click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
