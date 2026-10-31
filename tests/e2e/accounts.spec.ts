import { expect, test, type Page } from "@playwright/test";

const account = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  user_id: "11111111-1111-4111-8111-111111111111",
  holder_name: "Asha Mehta",
  broker_name: "Example Broker",
  broker_code: null,
  depository_type: "CDSL",
  masked_demat_identifier: "XXXX1234",
  masked_client_reference: null,
  account_status: "active",
  notes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  archived_at: null,
};

async function prepareAccountPage(page: Page) {
  await page.addInitScript(() => {
    const user = {
      id: "11111111-1111-4111-8111-111111111111",
      aud: "authenticated",
      role: "authenticated",
      email: "account@example.test",
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
        access_token: `eyJhbGciOiJub25lIn0.${payload}.test-signature`,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "test-refresh-token",
        user,
      }),
    );
  });
  await page.route("**/api/accounts**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          accounts: [account],
          pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
          summary: { total: 1, active: 1, archived: 0, remainingCapacity: 499 },
        },
      }),
    }),
  );
}

test("account list uses readable cards without horizontal page overflow on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await prepareAccountPage(page);
  await page.goto("/accounts/list");

  await expect(page.getByRole("heading", { name: "Account list" })).toBeVisible();
  await expect(page.getByRole("article")).toContainText("Asha Mehta");
  await expect(page.getByRole("article")).toContainText("XXXX1234");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("account list renders the TanStack table on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAccountPage(page);
  await page.goto("/accounts/list");

  await expect(page.getByRole("heading", { name: "Account list" })).toBeVisible();
  await expect(page.getByRole("table").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Asha Mehta" })).toBeVisible();
});
