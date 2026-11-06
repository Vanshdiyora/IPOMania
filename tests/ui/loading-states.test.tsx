// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "../../apps/web/src/components/layout/AppLayout";
import { SkeletonPage } from "../../apps/web/src/components/ui/Skeleton";
import { Button } from "../../apps/web/src/components/ui/Button";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";
import { IpoListPage } from "../../apps/web/src/pages/ipos/IpoPages";
import type * as ApiModule from "../../apps/web/src/lib/api";
import { Provider } from "react-redux";
import { createAppStore } from "../../apps/web/src/store";

const { authState, apiRequestMock } = vi.hoisted(() => ({
  authState: {
    loading: true,
    user: null as null | { id: string },
    session: null as null | { access_token: string },
  },
  apiRequestMock: vi.fn(),
}));

vi.mock("../../apps/web/src/auth/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("../../apps/web/src/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiRequest: apiRequestMock,
}));

describe("shared loading states", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("announces skeleton content as busy without exposing placeholder shapes", () => {
    render(
      <SkeletonPage label="Loading example">
        <div className="skeleton h-8 w-full" />
      </SkeletonPage>,
    );

    expect(screen.getByRole("status", { name: "Loading example" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByText("Loading example")).toHaveClass("sr-only");
  });

  it("disables a busy button and announces its loading state", () => {
    render(
      <Button loading type="submit">
        Saving…
      </Button>,
    );

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving…" })).toHaveAttribute("aria-busy", "true");
  });

  it("does not flash the public homepage while restoring a session", () => {
    authState.loading = true;
    authState.user = null;
    render(
      <Provider store={createAppStore()}>
        <MemoryRouter initialEntries={["/"]}>
          <ToastProvider>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<p>Public homepage</p>} />
              </Route>
            </Routes>
          </ToastProvider>
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.getByRole("status", { name: "Restoring your session" })).toBeInTheDocument();
    expect(screen.queryByText("Public homepage")).not.toBeInTheDocument();
  });

  it("shows IPO list placeholders instead of an empty state while loading", () => {
    authState.loading = false;
    authState.user = { id: "user-1" };
    authState.session = { access_token: "test-token" };
    apiRequestMock.mockReturnValue(new Promise(() => {}));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/ipos"]}>
          <IpoListPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("status", { name: "Loading IPO records" })).toBeInTheDocument();
    expect(screen.queryByText("No IPO records match these filters.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("IPO totals")).toHaveAttribute("aria-busy", "true");
    expect(container.querySelectorAll('section[aria-label="IPO totals"] .skeleton')).toHaveLength(
      12,
    );
  });
});
