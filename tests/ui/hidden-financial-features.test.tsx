// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "../../apps/web/src/components/layout/Sidebar";
import { router } from "../../apps/web/src/app/router";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";

vi.mock("../../apps/web/src/auth/useAuth", () => ({
  useAuth: () => ({
    user: { email: "user@example.test" },
    signOut: vi.fn(),
  }),
}));

describe("temporarily hidden financial screens", () => {
  it("removes financial navigation while keeping core navigation", () => {
    render(
      <ToastProvider>
        <MemoryRouter>
          <Sidebar mobileOpen={false} onNavigate={() => {}} onClose={() => {}} />
        </MemoryRouter>
      </ToastProvider>,
    );

    expect(screen.getByRole("link", { name: "Applications" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "IPOs" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mandates" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Allotments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Capital" })).not.toBeInTheDocument();
  });

  it("does not register the hidden URLs", () => {
    const appRoutes = router.routes.find((route) => route.path === "/")?.children ?? [];
    const paths = appRoutes.map((route) => route.path);

    expect(paths).toContain("applications");
    expect(paths).toContain("quota-calculator");
    expect(paths).not.toContain("mandates");
    expect(paths).not.toContain("allotments");
    expect(paths).not.toContain("capital");
    expect(paths.every((path) => !/^(mandates|allotments|capital)\//.test(path ?? ""))).toBe(true);
  });
});
