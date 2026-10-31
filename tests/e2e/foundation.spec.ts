import { expect, test } from "@playwright/test";

test("renders the light application foundation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Project foundation" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
});
