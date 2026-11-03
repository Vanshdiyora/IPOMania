// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type * as ApiModule from "../../apps/web/src/lib/api";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";
import { ApplicationFormPage } from "../../apps/web/src/pages/applications/ApplicationPages";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("../../apps/web/src/auth/useAuth", () => ({
  useAuth: () => ({ session: { access_token: "regular-user-token" } }),
}));
vi.mock("../../apps/web/src/components/ui/FormDrawer", () => ({
  RouteFormDrawer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../apps/web/src/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiRequest: apiRequestMock,
}));

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ToastProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/applications/new"]}>
          <ApplicationFormPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

describe("application form IPO selection", () => {
  it("explains how to add the first personal IPO when no options are returned", async () => {
    apiRequestMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/ipos?")) {
        return {
          data: {
            ipos: [],
            pagination: { page: 1, page_size: 25, total: 0, total_pages: 0 },
          },
        };
      }
      if (path.startsWith("/api/accounts?")) {
        return {
          data: {
            accounts: [],
            pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
          },
        };
      }
      throw new Error("Unexpected request: " + path);
    });

    renderForm();

    const addIpoLink = await screen.findByRole("link", { name: "Add an IPO" });
    expect(addIpoLink).toHaveAttribute("href", "/ipos/new");
    expect(addIpoLink.parentElement).toHaveTextContent(
      "No personal IPOs are available. Add an IPO and configure its category before recording an application.",
    );
  });
});
