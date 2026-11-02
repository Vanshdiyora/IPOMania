// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "../../apps/web/src/components/layout/Sidebar";

vi.mock("../../apps/web/src/auth/useAuth", () => ({
  useAuth: () => ({
    user: { email: "user@example.test" },
    signOut: vi.fn(),
  }),
}));

function renderSidebar(path: string, group: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar mobileOpen={false} onNavigate={() => {}} onClose={() => {}} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: group }));
  return within(screen.getByRole("navigation", { name: "Main navigation" }));
}

describe("sidebar active links", () => {
  it.each([
    ["/accounts", "Demat Accounts", "Account dashboard", "Account list"],
    ["/accounts/list", "Demat Accounts", "Account list", "Account dashboard"],
    ["/applications", "Applications", "App dashboard", "Application table"],
    ["/applications/list", "Applications", "Application table", "App dashboard"],
  ])("marks only the current page for %s", (path, group, active, inactive) => {
    const navigation = renderSidebar(path, group);

    expect(navigation.getByRole("link", { name: active })).toHaveAttribute("aria-current", "page");
    expect(navigation.getByRole("link", { name: inactive })).not.toHaveAttribute("aria-current");
    expect(navigation.getAllByRole("link", { current: "page" })).toHaveLength(1);
  });
});
