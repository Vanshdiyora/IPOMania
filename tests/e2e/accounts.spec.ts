import { expect, test, type Page } from "@playwright/test";
import { auditAccessibility } from "./accessibility";

const account = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  user_id: "11111111-1111-4111-8111-111111111111",
  holder_name: "Asha Mehta",
  bank_name: "Example Bank",
  username: "asha.mehta",
  password_saved: true,
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
  await page.route("**/api/accounts**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/password")) {
      return route.fulfill({ json: { data: { password: "example-bank-password" } } });
    }
    if (path.endsWith(`/${account.id}`)) {
      return route.fulfill({ json: { data: account } });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          accounts: [account],
          pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
          summary: { total: 1, active: 1, archived: 0 },
        },
      }),
    });
  });
}

test("accounts tab shows readable cards without horizontal page overflow on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await prepareAccountPage(page);
  await page.goto("/accounts");

  await expect(page.getByRole("heading", { name: "Demat accounts" })).toBeVisible();
  await expect(page.getByRole("article")).toContainText("Asha Mehta");
  await expect(page.getByRole("article")).toContainText("Example Bank");
  await expect(page.getByRole("article")).toContainText("••••••••");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("accounts tab renders the account table on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAccountPage(page);
  await page.goto("/accounts");

  await expect(page.getByRole("heading", { name: "Demat accounts" })).toBeVisible();
  await expect(page.getByRole("table").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Asha Mehta" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Bank" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Password" })).toBeVisible();
});

test("account detail masks the password until the user reveals it", async ({ page }) => {
  await prepareAccountPage(page);
  await page.goto(`/accounts/${account.id}`);

  await expect(page.getByText("••••••••")).toBeVisible();
  await page.getByRole("button", { name: "Reveal password" }).click();
  await expect(page.getByText("example-bank-password")).toBeVisible();
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(page.getByText("••••••••")).toBeVisible();
});

test("account dashboard shows totals without a capacity limit", async ({ page }) => {
  await prepareAccountPage(page);
  await page.goto("/accounts");

  await expect(page.getByText("Total accounts")).toBeVisible();
  await expect(page.getByText("Active accounts")).toBeVisible();
  await expect(page.getByText("Archived accounts")).toBeVisible();
  await expect(page.getByText(/capacity remaining|up to 500 unarchived/i)).toHaveCount(0);
});

test("opening the add-account drawer keeps the accounts tab URL", async ({ page }) => {
  await prepareAccountPage(page);
  await page.goto("/accounts");
  await page.getByRole("link", { name: "Add account", exact: true }).click();

  await expect(page).toHaveURL(/\/accounts$/);
  await expect(page.getByRole("dialog", { name: "Add demat account" })).toBeVisible();
});

test("legacy table routes redirect to the main tabs and keep filters", async ({ page }) => {
  await prepareAccountPage(page);
  await page.goto("/accounts/list?archived=true");
  await expect(page).toHaveURL(/\/accounts\?archived=true$/);

  await page.goto("/applications/list?application_status=SUBMITTED");
  await expect(page).toHaveURL(/\/applications\?application_status=SUBMITTED$/);
});

test("account list passes automated WCAG 2.2 AA checks", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareAccountPage(page);
  await page.goto("/accounts");
  expect(await auditAccessibility(page)).toEqual([]);
});
