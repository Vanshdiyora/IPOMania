import { expect, test, type Page } from "@playwright/test";
import { auditAccessibility } from "./accessibility";

const userId = "11111111-1111-4111-8111-111111111111";
const recordId = "88888888-8888-4888-8888-888888888888";
const account = {
  id: recordId,
  user_id: userId,
  holder_name: "Form test holder",
  broker_name: "Test broker",
  broker_code: null,
  depository_type: "CDSL",
  masked_demat_identifier: "XXXX1234",
  masked_client_reference: null,
  account_status: "active",
  notes: null,
  archived_at: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};
const ipo = {
  id: recordId,
  user_id: userId,
  company_name: "Form test company",
  symbol: "FORM",
  ipo_type: "Mainboard",
  exchange: "Test exchange",
  issue_price_min: "10.00",
  issue_price_max: "20.00",
  cut_off_price: null,
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
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  archived_at: null,
};

async function prepare(page: Page, admin = false) {
  await page.addInitScript(
    ({ userId, admin }) => {
      const user = {
        id: userId,
        aud: "authenticated",
        role: "authenticated",
        email: admin ? "admin@gmail.com" : "forms@example.test",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {},
        created_at: "2026-01-01T00:00:00.000Z",
      };
      const payload = btoa(
        JSON.stringify({
          sub: userId,
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
    },
    { userId, admin },
  );
  await page.route("**/rest/v1/profiles*", (route) =>
    route.fulfill({ json: { role: admin ? "ADMIN" : "USER" } }),
  );
  await page.route("**/api/accounts?*", (route) =>
    route.fulfill({
      json: {
        data: {
          accounts: [account],
          pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
          summary: { total: 1, active: 1, archived: 0 },
        },
      },
    }),
  );
  await page.route(`**/api/accounts/${recordId}`, (route) =>
    route.fulfill({ json: { data: account } }),
  );
  await page.route("**/api/ipos?*", (route) =>
    route.fulfill({
      json: {
        data: { ipos: [ipo], pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 } },
      },
    }),
  );
  await page.route("**/api/ipos/catalog?*", (route) =>
    route.fulfill({
      json: {
        data: { ipos: [], pagination: { page: 1, page_size: 25, total: 0, total_pages: 0 } },
      },
    }),
  );
  await page.route(`**/api/ipos/${recordId}`, (route) => route.fulfill({ json: { data: ipo } }));
  await page.route(`**/api/ipos/${recordId}/categories`, (route) =>
    route.fulfill({ json: { data: { configurations: [] } } }),
  );
  await page.route("**/api/admin/ipos/catalog", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: recordId,
            company_name: "Catalog test company",
            data_source: "IPO_GURU",
            symbol: "FORM",
            issue_type: "mainboard",
            ipo_status: "upcoming",
          },
        ],
      },
    }),
  );
  await page.route("**/api/admin/ipos/sync/status", (route) =>
    route.fulfill({
      json: {
        data: {
          providerConfigured: true,
          syncIntervalHours: 3,
          remainingManualRuns: 1,
          runsUsedToday: 0,
          running: false,
          nextAllowedAt: null,
        },
      },
    }),
  );
  await page.route("**/api/admin/ipos/settings", (route) =>
    route.fulfill({ json: { data: { providerConfigured: true } } }),
  );
  await page.route("**/api/admin/ipos/overview", (route) =>
    route.fulfill({ json: { data: { counts: { total: 1, upcoming: 1 }, recentSyncs: [] } } }),
  );
  await page.route("**/api/admin/ipos/sync/history", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: recordId,
            started_at: "2026-11-01T10:00:00Z",
            trigger_type: "manual",
            provider: "IPO_GURU",
            status: "COMPLETED",
            records_fetched: 1,
            records_inserted: 1,
            records_updated: 0,
            records_failed: 0,
          },
        ],
      },
    }),
  );
}

test("account form preserves typed values, validates, saves, and loads existing values", async ({
  page,
}) => {
  await prepare(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/accounts/list");
  await page
    .getByRole("link", { name: /Add.*account/i })
    .first()
    .click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toHaveAccessibleName("Add demat account");
  await page.getByRole("button", { name: "Save account", exact: true }).click();
  await expect(page.getByLabel("Account holder name")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Account holder name").fill("New test holder");
  await page.getByRole("textbox", { name: "Broker name", exact: true }).fill("New test broker");
  await page.getByLabel("Depository", { exact: true }).selectOption("CDSL");
  await page.getByLabel("Masked demat identifier").fill("XXXX5678");
  await page.getByLabel("Notes (optional)").fill("A saved note");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByRole("textbox", { name: "Broker name", exact: true })).toHaveValue(
    "New test broker",
  );
  expect(await auditAccessibility(page)).toEqual([]);
  await page.route("**/api/accounts", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      holder_name: "New test holder",
      broker_name: "New test broker",
      depository_type: "CDSL",
      notes: "A saved note",
    });
    await route.fulfill({ json: { data: account } });
  });
  await page.getByRole("button", { name: "Save account", exact: true }).click();
  await expect(page).toHaveURL(/\/accounts\/list$/);
  await page.goto(`/accounts/${recordId}/edit`);
  await expect(page.getByLabel("Account holder name")).toHaveValue(account.holder_name);
  await expect(page.getByLabel("Depository", { exact: true })).toHaveValue("CDSL");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("IPO validation, back navigation and optional fields work inside the drawer", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/ipos?source=personal");
  await page.getByRole("link", { name: "Add IPO", exact: true }).click();
  await page.getByRole("button", { name: "Add IPO", exact: true }).click();
  await expect(page.getByLabel("Company name")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Company name").fill("Unsaved company");
  await page.goBack();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByLabel("Company name")).toHaveValue("Unsaved company");
  await page
    .getByRole("dialog", { name: "Add IPO" })
    .getByRole("button", { name: "Cancel" })
    .click();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto(`/ipos/${recordId}/edit`);
  await expect(page.getByLabel("Lot size")).toHaveValue("10");
  await page.getByLabel("Issue price minimum").fill("11.00");
  await page.route(`**/api/ipos/${recordId}`, async (route) => {
    if (route.request().method() === "PATCH")
      expect(route.request().postDataJSON()).toMatchObject({
        issue_price_min: "11.00",
        cut_off_price: null,
        listing_date: null,
      });
    await route.fulfill({ json: { data: ipo } });
  });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(new RegExp(`/ipos/${recordId}$`));
});

test("application form hides financial statuses and preserves them on edit", async ({ page }) => {
  await prepare(page);
  await page.goto("/applications/new");
  await expect(page.getByRole("dialog", { name: "Add application" })).toBeVisible();
  await expect(page.getByLabel("Mandate status")).toHaveCount(0);
  await expect(page.getByLabel("Allotment status")).toHaveCount(0);

  const application = {
    id: recordId,
    ipo_id: recordId,
    demat_account_id: recordId,
    category_id: recordId,
    lots: 1,
    application_number: "EXISTING-1",
    external_reference: null,
    submission_date: null,
    application_status: "SUBMITTED",
    mandate_status: "APPROVED",
    allotment_status: "ALLOTTED",
    notes: null,
  };
  await page.route(`**/api/applications/${recordId}`, async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body).not.toHaveProperty("mandate_status");
      expect(body).not.toHaveProperty("allotment_status");
    }
    await route.fulfill({ json: { data: application } });
  });
  await page.goto(`/applications/${recordId}/edit`);
  await expect(page.getByRole("dialog", { name: "Edit application" })).toBeVisible();
  await expect(page.getByLabel("Application number")).toHaveValue("EXISTING-1");
  await expect(page.getByLabel("Mandate status")).toHaveCount(0);
  await expect(page.getByLabel("Allotment status")).toHaveCount(0);
  await page.getByRole("button", { name: "Save application" }).click();
  await expect(page).toHaveURL(/\/applications\/list$/);
});

test("admin typing remains focused, errors stay inline, and edits and archive actions work", async ({
  page,
}) => {
  await prepare(page, true);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin/ipos");
  await page.getByRole("button", { name: "Add IPO", exact: true }).click();
  await page.getByLabel("Company name").fill("Typed company");
  await page.getByLabel("Symbol", { exact: true }).pressSequentially("test");
  await expect(page.getByLabel("Symbol", { exact: true })).toHaveValue("TEST");
  await expect(page.getByLabel("Symbol", { exact: true })).toBeFocused();
  await page.getByLabel("Issue price", { exact: true }).fill("invalid");
  await page.getByRole("button", { name: "Create IPO" }).click();
  await expect(page.getByLabel("Issue price", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).filter({ visible: true }).click();
  await expect(page.getByLabel("Company name")).toHaveValue("Catalog test company");
  await page.getByLabel("Company name").fill("Updated company");
  await page.route(`**/api/admin/ipos/catalog/${recordId}`, async (route) => {
    if (route.request().method() === "PATCH") {
      expect(route.request().postDataJSON()).toMatchObject({
        data_source: "IPO_GURU",
        company_name: "Updated company",
      });
    }
    await route.fulfill({ json: { data: { id: recordId } } });
  });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("IPO updated", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Archive", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("alertdialog")).toHaveAccessibleName("Archive this IPO?");
  await page.getByRole("button", { name: "Archive IPO", exact: true }).click();
  await expect(page.getByText("IPO archived", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const width of [360, 390, 768, 1366, 1440, 1920]) {
  test(`personal and admin drawers fit and keep their footers visible at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await prepare(page, true);
    for (const [path, action] of [
      ["/ipos/new", "Add IPO"],
      ["/accounts/new", "Save account"],
      ["/applications/new", "Save application"],
      ["/admin/ipos", "Create IPO"],
    ]) {
      await page.goto(path!);
      if (path === "/admin/ipos")
        await page.getByRole("button", { name: "Add IPO", exact: true }).click();
      const drawer = page.getByRole("dialog");
      await expect(drawer).toBeVisible();
      await expect(page.getByRole("button", { name: action, exact: true })).toBeInViewport();
      const bounds = await drawer.boundingBox();
      expect(Math.round(bounds!.width)).toBeLessThanOrEqual(width < 576 ? width : 576);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
      if (path === "/ipos/new" || path === "/admin/ipos") {
        await page.screenshot({
          path: testInfo.outputPath(`${path === "/ipos/new" ? "personal" : "admin"}-${width}.png`),
        });
        expect(await auditAccessibility(page)).toEqual([]);
      }
    }
  });
}

for (const width of [390, 1440]) {
  test(`admin pages, history search and synchronization confirmation work at ${width}px`, async ({
    page,
  }) => {
    await prepare(page, true);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of ["/admin", "/admin/ipo-sync-history", "/admin/settings", "/admin/sync"]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      if (path.endsWith("ipo-sync-history")) {
        await page
          .getByRole("searchbox", { name: "Search synchronization history" })
          .fill("no match");
        await expect(page.getByText("No synchronization runs found")).toBeVisible();
        await page.getByRole("button", { name: "Clear search" }).click();
        await expect(page.getByText("COMPLETED").filter({ visible: true })).toBeVisible();
      }
      if (path.endsWith("settings"))
        await expect(page.getByText("Interval: 3 hours")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(await auditAccessibility(page)).toEqual([]);
    }
    let runs = 0;
    await page.route("**/api/admin/ipos/sync", async (route) => {
      runs += 1;
      await route.fulfill({ json: { data: { recordsInserted: 2, recordsUpdated: 1 } } });
    });
    await page.getByRole("button", { name: "Fetch Latest IPO Data" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    expect(runs).toBe(0);
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    expect(runs).toBe(0);
    await page.getByRole("button", { name: "Fetch Latest IPO Data" }).click();
    await page.getByRole("button", { name: "Start synchronization", exact: true }).click();
    await expect(page.getByText("Completed: 2 inserted, 1 updated.")).toBeVisible();
    expect(runs).toBe(1);
    expect(errors).toEqual([]);
  });
}

test("admin catalog filters, paginates, and recovers from a loading failure", async ({ page }) => {
  await prepare(page, true);
  let fail = true;
  await page.route("**/api/admin/ipos/catalog", (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { error: { message: "Catalog unavailable." } } }
        : {
            json: {
              data: Array.from({ length: 21 }, (_, index) => ({
                id: `${index}`,
                company_name: `Company ${index}`,
                symbol: `TEST${index}`,
                issue_type: "mainboard",
                ipo_status: index === 20 ? "listed" : "upcoming",
              })),
            },
          },
    ),
  );
  await page.goto("/admin/ipos");
  await expect(page.getByRole("alert")).toContainText("Catalog unavailable.");
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Page 1 of 2 · 21 records")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 2 · 21 records")).toBeVisible();
  await page.getByRole("combobox", { name: "Filter catalog status" }).selectOption("listed");
  await expect(page.getByText("Page 1 of 1 · 1 records")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search IPO catalog" }).fill("missing");
  await expect(page.getByText("No IPOs found.").filter({ visible: true })).toBeVisible();
});

test("category switching protects unsaved rule changes", async ({ page }) => {
  await prepare(page);
  await page.goto(`/ipos/${recordId}/categories`);
  await page.getByLabel("Lot increment").fill("2");
  await page.getByLabel("Category", { exact: true }).selectOption("BHNI");
  await expect(page.getByRole("alertdialog")).toHaveAccessibleName("Discard category changes?");
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue("RETAIL");
  await expect(page.getByLabel("Lot increment")).toHaveValue("2");
  await page.getByLabel("Category", { exact: true }).selectOption("BHNI");
  await page.getByRole("button", { name: "Switch category" }).click();
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue("BHNI");
  await expect(page.getByLabel("Lot increment")).toHaveValue("");
});

test("admin mobile navigation traps focus, closes with Escape, and navigates", async ({ page }) => {
  await prepare(page, true);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/admin/ipos");
  const trigger = page.getByRole("button", { name: "Open navigation", exact: true });
  await trigger.click();
  const menu = page.getByRole("dialog", { name: "Admin navigation" });
  await expect(menu.getByRole("button", { name: "Close navigation", exact: true })).toBeFocused();
  expect(await auditAccessibility(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await menu.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(menu).toHaveCount(0);
});
