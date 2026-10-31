import { expect, test } from "@playwright/test";

test("renders the light application shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Welcome to IPO Mania" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
});

test("redirects unauthenticated users from the profile to sign in", async ({ page }) => {
  await page.goto("/profile");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("shows accessible registration validation errors", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Enter your name.")).toBeVisible();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Use at least 12 characters.")).toBeVisible();
});
