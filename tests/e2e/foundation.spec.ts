import { expect, test } from "@playwright/test";
import { auditAccessibility } from "./accessibility";

test("renders the full-width light landing page without app navigation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /Orchestrate IPO applications across all demat accounts/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveCount(0);
  const mainBounds = await page.getByRole("main").boundingBox();
  expect(mainBounds?.x).toBe(0);
  expect(mainBounds?.width).toBe(page.viewportSize()?.width);
});

test("public shell passes automated WCAG 2.2 AA checks", async ({ page }) => {
  await page.goto("/");
  expect(await auditAccessibility(page)).toEqual([]);
});

test("redirects unauthenticated users from the profile to sign in", async ({ page }) => {
  await page.goto("/profile");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("shows accessible registration validation errors", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Use at least 12 characters.")).toBeVisible();
});
