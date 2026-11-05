// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "../../apps/web/src/components/layout/AppLayout";
import { WelcomePage } from "../../apps/web/src/pages/WelcomePage";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";
import { Provider } from "react-redux";
import { createAppStore } from "../../apps/web/src/store";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock("../../apps/web/src/auth/useAuth", () => ({ useAuth: useAuthMock }));

function renderLayout(path = "/") {
  return render(
    <Provider store={createAppStore()}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<WelcomePage />} />
              <Route path="/dashboard" element={<h1>Dashboard content</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </Provider>,
  );
}

describe("AppLayout", () => {
  beforeEach(() => useAuthMock.mockReturnValue({ user: null }));

  it("renders the public landing content without the authenticated shell", () => {
    renderLayout();

    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(
      screen.getByRole("heading", {
        name: /A clearer way to manage your IPO records/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open navigation" })).not.toBeInTheDocument();
  });

  it("keeps the navigation shell without a persistent header for the authenticated home route", () => {
    useAuthMock.mockReturnValue({ user: { email: "investor@example.test" } });
    renderLayout();

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open navigation" })).toBeInTheDocument();
  });

  it("preserves the application layout on other routes", () => {
    renderLayout("/dashboard");

    expect(screen.getByRole("heading", { name: "Dashboard content" })).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
    expect(screen.getByRole("main")).not.toHaveClass("max-w-7xl", "mx-auto");
  });
});
