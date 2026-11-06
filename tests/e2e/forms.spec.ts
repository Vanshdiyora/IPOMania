import { expect, test, type Page } from "@playwright/test";
import { auditAccessibility } from "./accessibility";

const userId = "11111111-1111-4111-8111-111111111111";
const recordId = "88888888-8888-4888-8888-888888888888";
const account = {
  id: recordId,
  user_id: userId,
  holder_name: "Form test holder",
  bank_name: "Example Bank",
  username: "form-user",
  password_saved: true,
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
  await page.route(/\/api\/accounts(?:\?|$)/, (route) =>
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
  await page.route(/\/api\/ipos(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        data: { ipos: [ipo], pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 } },
      },
    }),
  );
  await page.route(/\/api\/applications(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        data: {
          applications: [],
          pagination: { page: 1, page_size: 100, total: 0, total_pages: 0 },
        },
      },
    }),
  );
  await page.route(/\/api\/ipos\/catalog(?:\?|$)/, (route) =>
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
  await page.route("**/api/admin/ipos/catalog?**", (route) =>
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
  await page.route("**/api/admin/ipos/sync/history?**", (route) => {
    const search = new URL(route.request().url()).searchParams.get("search") ?? "";
    return route.fulfill({
      json: {
        data:
          search && !"manual IPO_GURU COMPLETED".toLowerCase().includes(search.toLowerCase())
            ? []
            : [
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
    });
  });
}

test("account form preserves typed values, validates, saves, and loads existing values", async ({
  page,
}) => {
  await prepare(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/accounts");
  await page
    .getByRole("link", { name: /Add.*account/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/accounts$/);
  const drawer = page.getByRole("dialog");
  await expect(drawer).toHaveAccessibleName("Add demat account");
  await page.getByRole("button", { name: "Save account", exact: true }).click();
  await expect(page.getByLabel("Account holder name")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Account holder name").fill("New test holder");
  await page.getByLabel("Bank name").fill("Example Bank");
  await page.getByLabel("Username").fill("new-user");
  await page.getByLabel("Password").fill("new-password");
  await page.getByLabel("Notes (optional)").fill("A saved note");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  expect(await auditAccessibility(page)).toEqual([]);
  await page.route("**/api/accounts", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      holder_name: "New test holder",
      bank_name: "Example Bank",
      username: "new-user",
      password: "new-password",
      notes: "A saved note",
    });
    await route.fulfill({ json: { data: account } });
  });
  await page.getByRole("button", { name: "Save account", exact: true }).click();
  await expect(page).toHaveURL(/\/accounts$/);
  await expect(page.getByText("Account created.")).toBeVisible();
  await page.goto(`/accounts/${recordId}/edit`);
  await expect(page.getByLabel("Account holder name")).toHaveValue(account.holder_name);
  await expect(page.getByLabel("Bank name")).toHaveValue(account.bank_name);
  await expect(page.getByLabel("Username")).toHaveValue(account.username);
  await expect(page.getByLabel("Password")).toHaveValue("");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("regular users cannot open the IPO creation form", async ({ page }) => {
  await prepare(page);
  await page.goto("/ipos/new");
  await expect(page).toHaveURL(/\/ipos$/);
  await expect(page.getByRole("heading", { name: "IPO catalog", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Add to catalog", exact: true })).toHaveCount(0);
});

test("application form hides financial statuses and preserves them on edit", async ({ page }) => {
  test.setTimeout(90_000);
  await prepare(page);
  const ownedIpoRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/ipos" && url.searchParams.get("page") === "1";
  });
  await page.goto("/applications/new");
  await expect(page.getByRole("dialog", { name: "Add application" })).toBeVisible({
    timeout: 30_000,
  });
  await ownedIpoRequest;
  await expect(page.getByLabel("Mandate status")).toHaveCount(0);
  await expect(page.getByLabel("Allotment status")).toHaveCount(0);

  const application = {
    id: recordId,
    ipo_id: recordId,
    demat_account_id: recordId,
    category_id: null,
    category_code: "RETAIL",
    lots: 1,
    total_shares: 10,
    application_amount: "200.00",
    application_number: "EXISTING-1",
    external_reference: null,
    submission_date: null,
    application_status: "SUBMITTED",
    mandate_status: "APPROVED",
    allotment_status: "ALLOTTED",
    notes: null,
    calculation_snapshot: { calculation_input: { price: "20.00", price_type: "BID" } },
  };
  await page.route(`**/api/applications/${recordId}`, async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body).toMatchObject({
        category_id: null,
        category_code: "RETAIL",
        lots: 1,
        price: "20.00",
      });
      expect(body).not.toHaveProperty("mandate_status");
      expect(body).not.toHaveProperty("allotment_status");
    }
    await route.fulfill({ json: { data: application } });
  });
  await page.route(/\/api\/applications(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        data: {
          applications: [{ ...application, archived_at: null }],
          pagination: { page: 1, page_size: 100, total: 1, total_pages: 1 },
        },
      },
    }),
  );
  await page.goto(`/applications/${recordId}/edit`);
  await expect(page.getByRole("dialog", { name: "Edit application" })).toBeVisible();
  await expect(page.getByLabel("Application number")).toHaveCount(0);
  await expect(page.getByLabel("External reference")).toHaveCount(0);
  await expect(page.getByLabel("Investor category")).toBeVisible();
  await expect(page.getByLabel("Lots")).toHaveValue("1");
  await expect(page.getByLabel("Price")).toHaveValue("20.00");
  await expect(
    page.getByText(/An active application already exists for this IPO and demat account/),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save application" })).toBeEnabled();
  await expect(page.getByLabel("Mandate status")).toHaveCount(0);
  await expect(page.getByLabel("Allotment status")).toHaveCount(0);
  await page.getByRole("button", { name: "Save application" }).click();
  await expect(page).toHaveURL(/\/applications$/);
});

test("preselected IPO data enables application saving and applies category lot ranges", async ({
  page,
}) => {
  await prepare(page);
  const categories = [
    { category: "RETAIL", maximum_lots: 5, minimum_investment: null, maximum_investment: "400" },
    { category: "SHNI", maximum_lots: null, minimum_investment: "600", maximum_investment: "2000" },
    { category: "BHNI", maximum_lots: null, minimum_investment: "2200", maximum_investment: null },
    {
      category: "SHAREHOLDER",
      maximum_lots: 4,
      minimum_investment: null,
      maximum_investment: null,
    },
  ].map((rule, index) => ({
    id: `category-${index}`,
    ipo_id: recordId,
    source_catalog_rule_id: null,
    ...rule,
    rule_version: 1,
    lot_limit_status: rule.maximum_lots === null ? "NO_PUBLISHED_LIMIT" : "CONFIGURED",
    default_lots: 1,
    minimum_lots: 1,
    lot_increment: 1,
    investment_limit_status: "CONFIGURED",
    reserved_shares: null,
    reserved_percentage: null,
    shareholder_record_date: rule.category === "SHAREHOLDER" ? "2026-10-01" : null,
    minimum_shareholding: rule.category === "SHAREHOLDER" ? 1 : null,
    eligibility_conditions: [],
    allowed_price_types: ["BID", "CUT_OFF"],
    minimum_price_increment: "0.01",
    source_reference: "IPO-specific test configuration",
    rule_source: "PUBLISHED_SOURCE",
    last_verified_at: "2026-11-01T00:00:00Z",
    created_at: "2026-11-01T00:00:00Z",
  }));
  await page.route(`**/api/ipos/${recordId}/categories`, (route) =>
    route.fulfill({ json: { data: { configurations: categories } } }),
  );
  await page.goto(`/applications/new?ipo_id=${recordId}`);
  await expect(page.getByRole("combobox", { name: "IPO" })).toHaveText("Form test company");
  await expect(page.getByLabel("Price")).toHaveValue("20.00");
  await page.getByRole("combobox", { name: "Demat account" }).click();
  await page.getByRole("option", { name: /Form test holder/ }).click();

  const category = page.getByLabel("Investor category");
  await category.click();
  await expect(page.getByRole("option", { name: /Retail/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /sHNI/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /bHNI/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Shareholder/ })).toBeVisible();
  const lots = page.getByLabel("Lots");

  await page.getByRole("option", { name: /Retail/ }).click();
  await expect(lots).toHaveAttribute("min", "1");
  await expect(lots).toHaveAttribute("max", "2");
  await expect(page.getByText("Total amount: ₹200")).toBeVisible();

  await category.click();
  await page.getByRole("option", { name: /sHNI/ }).click();
  await expect(lots).toHaveValue("3");
  await expect(lots).toHaveAttribute("max", "10");
  await expect(page.getByText("Total amount: ₹600")).toBeVisible();

  await category.click();
  await page.getByRole("option", { name: /bHNI/ }).click();
  await expect(lots).toHaveValue("11");
  await expect(lots).not.toHaveAttribute("max", /.+/);

  await category.click();
  await page.getByRole("option", { name: /Shareholder/ }).click();
  await expect(lots).toHaveValue("1");
  await expect(lots).toHaveAttribute("max", "4");
  await expect(page.getByRole("button", { name: "Save application" })).toBeEnabled();
});

test("opening the add-application drawer keeps the applications tab URL", async ({ page }) => {
  await prepare(page);
  await page.goto("/applications");
  await page.getByRole("link", { name: "Add application", exact: true }).first().click();

  await expect(page).toHaveURL(/\/applications$/);
  await expect(page.getByRole("dialog", { name: "Add application" })).toBeVisible();
});

test("admin typing remains focused, errors stay inline, and edits and archive actions work", async ({
  page,
}) => {
  await prepare(page, true);
  const errors: string[] = [];
  let catalogGets = 0;
  page.on("request", (request) => {
    if (request.method() === "GET" && new URL(request.url()).pathname === "/api/admin/ipos/catalog")
      catalogGets += 1;
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin/ipos");
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }).filter({ visible: true }),
  ).toBeVisible();
  const requestsBeforeSave = catalogGets;
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
  await expect.poll(() => catalogGets).toBe(requestsBeforeSave + 1);
  const requestsBeforeArchive = catalogGets;
  await page
    .getByRole("button", { name: "Archive", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("alertdialog")).toHaveAccessibleName("Archive this IPO?");
  await page.getByRole("button", { name: "Archive IPO", exact: true }).click();
  await expect(page.getByText("IPO archived", { exact: true })).toBeVisible();
  await expect.poll(() => catalogGets).toBe(requestsBeforeArchive + 1);
  expect(errors).toEqual([]);
});

for (const width of [360, 390, 768, 1366, 1440, 1920]) {
  test(`account, application, and admin drawers fit and keep their footers visible at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await prepare(page, true);
    for (const [path, action] of [
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
      if (path === "/admin/ipos") {
        await page.screenshot({
          path: testInfo.outputPath(`admin-${width}.png`),
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
      if (path.endsWith("/sync"))
        await expect(page.getByRole("button", { name: "Fetch Latest IPO Data" })).toBeEnabled();
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
    await expect(page.getByText("IPO synchronization complete")).toBeVisible();
    await expect(page.getByText("2 inserted, 1 updated.")).toBeVisible();
    expect(runs).toBe(1);
    expect(errors).toEqual([]);
  });
}

test("admin catalog filters, paginates, and recovers from a loading failure", async ({ page }) => {
  await prepare(page, true);
  let fail = true;
  await page.route("**/api/admin/ipos/catalog?**", (route) => {
    if (fail)
      return route.fulfill({ status: 503, json: { error: { message: "Catalog unavailable." } } });
    const params = new URL(route.request().url()).searchParams;
    const pageNumber = Number(params.get("page") ?? 1);
    const pageSize = Number(params.get("page_size") ?? 10);
    const search = (params.get("search") ?? "").toLowerCase();
    const status = params.get("status");
    const matching = Array.from({ length: 21 }, (_, index) => ({
      id: `${index}`,
      company_name: `Company ${index}`,
      symbol: `TEST${index}`,
      issue_type: "mainboard",
      ipo_status: index === 20 ? "listed" : "upcoming",
    })).filter(
      (row) =>
        (!status || row.ipo_status === status) &&
        (!search || `${row.company_name} ${row.symbol}`.toLowerCase().includes(search)),
    );
    return route.fulfill({
      json: {
        data: matching.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
        pagination: {
          page: pageNumber,
          page_size: pageSize,
          total: matching.length,
          total_pages: Math.max(1, Math.ceil(matching.length / pageSize)),
        },
      },
    });
  });
  await page.goto("/admin/ipos");
  await expect(page.getByRole("alert")).toContainText("Catalog unavailable.");
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  const pagination = page.getByRole("navigation", { name: "Catalog pagination" });
  await expect(pagination).toContainText("Page 1 of 3");
  await expect(pagination).toContainText("21 records");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(pagination).toContainText("Page 2 of 3");
  await expect(pagination).toContainText("21 records");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const catalogStatus = page.getByRole("combobox", { name: "Filter catalog status" });
  await catalogStatus.click();
  await page.getByRole("option", { name: "Listed", exact: true }).click();
  await page.getByRole("button", { name: "Apply filters (1)", exact: true }).click();
  await expect(pagination).toContainText("Page 1 of 1");
  await expect(pagination).toContainText("1 records");
  await expect(page.getByRole("dialog", { name: "IPO catalog filters" })).toHaveCount(0);
  const search = page.getByRole("searchbox", { name: "Search IPO catalog" });
  await search.fill("missing");
  await expect(search).toHaveValue("missing");
  await expect(page.getByText("No IPOs found.").filter({ visible: true })).toBeVisible();
});

test("admin catalog view returns to the filtered management list", async ({ page }) => {
  await prepare(page, true);
  await page.route(`**/api/ipos/catalog/${recordId}`, (route) =>
    route.fulfill({
      json: { data: { ...ipo, company_name: "Catalog test company", data_source: "IPO_GURU" } },
    }),
  );
  await page.goto("/admin/ipos?search=Catalog&status=upcoming");
  await expect(page.getByRole("searchbox", { name: "Search IPO catalog" })).toHaveValue("Catalog");
  await page
    .getByRole("link", { name: "View", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Catalog test company" })).toBeVisible();
  await page.getByRole("link", { name: "Back to IPOs" }).click();
  await expect(page).toHaveURL(/\/admin\/ipos\?search=Catalog&status=upcoming$/);
  await expect(page.getByRole("searchbox", { name: "Search IPO catalog" })).toHaveValue("Catalog");
});

test("administrator status request is reused across overview, sync, and settings", async ({
  page,
}) => {
  await prepare(page, true);
  let statusRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/admin/ipos/sync/status") statusRequests += 1;
  });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "IPO overview" })).toBeVisible();
  await expect(page.getByText(/Manual runs remaining:/)).toBeVisible();
  const requestsAfterOverview = statusRequests;
  expect(requestsAfterOverview).toBeGreaterThan(0);

  await page.getByRole("link", { name: "IPO Data Sync" }).click();
  await expect(page.getByRole("heading", { name: "IPO data sync", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Administration settings" })).toBeVisible();
  expect(statusRequests).toBe(requestsAfterOverview);
});

test("disabled synchronization actions retain readable contrast", async ({ page }) => {
  await prepare(page, true);
  await page.route("**/api/admin/ipos/sync/status", (route) =>
    route.fulfill({
      json: {
        data: {
          providerConfigured: false,
          syncIntervalHours: 3,
          remainingManualRuns: 0,
          runsUsedToday: 0,
          running: false,
          nextAllowedAt: null,
        },
      },
    }),
  );
  await page.goto("/admin/sync");
  await expect(page.getByRole("button", { name: "Fetch Latest IPO Data" })).toBeDisabled();
  expect(await auditAccessibility(page)).toEqual([]);
});

test("application search and IPO filter update the actual list request", async ({ page }) => {
  await prepare(page);
  await page.route(/\/api\/applications(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        data: {
          applications: [],
          pagination: { page: 1, page_size: 50, total: 0, total_pages: 1 },
        },
      },
    }),
  );
  await page.goto("/applications");
  const searchRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/applications" && url.searchParams.get("ipo_search") === "Form";
  });
  await page.getByRole("textbox", { name: "Search IPO or company name" }).fill("Form");
  await searchRequest;

  const ipoFilter = page.getByRole("combobox", { name: "View applications for IPO" });
  await ipoFilter.click();
  const optionSearch = page.getByPlaceholder("Search IPOs...");
  await expect(optionSearch).toBeFocused();
  await optionSearch.press("Tab");
  await expect(page.getByRole("option", { name: /Form test company/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(ipoFilter).toHaveAttribute("aria-expanded", "false");
  await ipoFilter.click();
  const filteredRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/applications" && url.searchParams.get("ipo_id") === recordId;
  });
  await page.getByRole("option", { name: /Form test company/ }).click();
  await filteredRequest;
  await expect(page).toHaveURL(new RegExp(`ipo_id=${recordId}`));
});

test("IPO catalog search waits until the user finishes typing", async ({ page }) => {
  await prepare(page);
  let catalogRequests = 0;
  page.route("**/api/ipos/catalog?**", (route) => {
    catalogRequests += 1;
    return route.fulfill({
      json: {
        data: {
          ipos: [ipo],
          pagination: { page: 1, page_size: 25, total: 1, total_pages: 1 },
        },
      },
    });
  });
  await page.goto("/ipos");
  await expect(page.getByRole("heading", { name: "IPO catalog" })).toBeVisible();
  const search = page.getByRole("textbox", { name: "Search company or exact symbol" });
  await search.fill("F");
  await search.fill("Fo");
  await search.fill("Form");
  await expect(search).toHaveValue("Form");
  await expect.poll(() => catalogRequests).toBe(2);
  expect(catalogRequests).toBe(2);
});

test("application filter options remain visible in the mobile drawer", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await prepare(page);
  await page.route(/\/api\/applications(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        data: {
          applications: [],
          pagination: { page: 1, page_size: 50, total: 0, total_pages: 1 },
        },
      },
    }),
  );
  await page.goto("/applications");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("combobox", { name: "Records to show", exact: true }).click();
  const box = await page.getByRole("listbox", { name: "Records to show" }).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(800);
});

test("category switching protects unsaved rule changes", async ({ page }) => {
  await prepare(page);
  await page.goto(`/ipos/${recordId}/categories`);
  await page.getByLabel("Lot increment").fill("2");
  const category = page.getByRole("combobox", { name: "Category" });
  await category.click();
  await page.getByRole("option", { name: "BHNI", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveAccessibleName("Discard category changes?");
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(category).toContainText("RETAIL");
  await expect(page.getByLabel("Lot increment")).toHaveValue("2");
  await category.click();
  await page.getByRole("option", { name: "BHNI", exact: true }).click();
  await page.getByRole("button", { name: "Switch category" }).click();
  await expect(category).toContainText("BHNI");
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
