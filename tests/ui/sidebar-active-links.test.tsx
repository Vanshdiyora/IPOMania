// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "../../apps/web/src/components/layout/Sidebar";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../../apps/web/src/auth/useAuth", () => ({
  useAuth: () => ({
    user: { email: "user@example.test" },
    signOut: signOutMock,
  }),
}));

function renderSidebar(path: string) {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Sidebar mobileOpen={false} onNavigate={() => {}} onClose={() => {}} />
      </MemoryRouter>
    </ToastProvider>,
  );
  return within(screen.getByRole("navigation", { name: "Main navigation" }));
}

describe("sidebar active links", () => {
  it.each([
    ["/accounts", "Demat Accounts", "Applications"],
    ["/accounts/list", "Demat Accounts", "Applications"],
    ["/applications", "Applications", "Demat Accounts"],
    ["/applications/list", "Applications", "Demat Accounts"],
    ["/ipo-calendar", "IPOs", "Applications"],
  ])("marks the current section for %s", (path, active, inactive) => {
    const navigation = renderSidebar(path);

    expect(navigation.getByRole("link", { name: active })).toHaveAttribute("aria-current", "page");
    expect(navigation.getByRole("link", { name: inactive })).not.toHaveAttribute("aria-current");
    expect(navigation.getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it("announces successful sign out in a toast", async () => {
    renderSidebar("/accounts");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Signed out")).toBeInTheDocument();
  });
});
