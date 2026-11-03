// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "../../apps/web/src/lib/api";
import { IpoCatalogDetailsPage, IpoListPage } from "../../apps/web/src/pages/ipos/IpoPages";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock("../../apps/web/src/auth/useAuth", () => ({
  useAuth: () => ({ session: { access_token: "regular-user-token" } }),
}));
vi.mock("../../apps/web/src/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiRequest: apiRequestMock,
}));

const catalogIpo = {
  id: "88888888-8888-4888-8888-888888888888",
  company_name: "Admin Catalog Test Company",
  symbol: null,
  exchange: null,
  ipo_type: "MAINBOARD",
  issue_price_min: null,
  issue_price_max: null,
  cut_off_price: null,
  issue_size: null,
  lot_size: null,
  opening_date: null,
  closing_date: null,
  allotment_date: null,
  listing_date: null,
  last_verified_at: null,
  source_reference: null,
  status: "UPCOMING",
  data_source: "IPO_GURU",
};

function listResponse(ipos = [catalogIpo], page = 1, totalPages = 1) {
  return {
    data: {
      ipos,
      pagination: { page, page_size: 25, total: totalPages * 25, total_pages: totalPages },
    },
  };
}

function renderPage(path = "/ipos") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/ipos" element={<IpoListPage />} />
          <Route path="/ipo-calendar" element={<IpoListPage calendar />} />
          <Route path="/ipos/catalog/:ipoId" element={<IpoCatalogDetailsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("user IPO catalog", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("loads shared IPOs by default and shows incomplete provider data without hiding the name", async () => {
    apiRequestMock.mockResolvedValue(listResponse());
    renderPage();
    const link = await screen.findByRole("link", { name: catalogIpo.company_name });
    expect(link).toHaveAttribute("href", `/ipos/catalog/${catalogIpo.id}`);
    expect(screen.getByRole("button", { name: "IPO catalog" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Admin-managed · IPO Guru")).toBeInTheDocument();
    expect(screen.getAllByText("Not published")).toHaveLength(2);
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/ipos/catalog?page=1&page_size=25",
      expect.anything(),
    );
  });

  it("keeps personal IPO records and their original details links available", async () => {
    apiRequestMock.mockImplementation(async (path: string) =>
      listResponse([
        {
          ...catalogIpo,
          company_name: path.startsWith("/api/ipos?")
            ? "Personal Test Company"
            : catalogIpo.company_name,
          data_source: "MANUAL",
        },
      ]),
    );
    renderPage();
    await screen.findByRole("link", { name: catalogIpo.company_name });
    fireEvent.click(screen.getByRole("button", { name: "My IPOs" }));
    expect(await screen.findByRole("link", { name: "Personal Test Company" })).toHaveAttribute(
      "href",
      `/ipos/${catalogIpo.id}`,
    );
    expect(screen.getByText("Manual entry · unverified")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "IPO calendar" })).toHaveAttribute(
      "href",
      "/ipo-calendar?source=personal",
    );
    expect(apiRequestMock).toHaveBeenCalledWith("/api/ipos?page=1&page_size=25", expect.anything());
  });

  it("sends search, status, and pagination to the catalog and resets them when switching sources", async () => {
    apiRequestMock.mockResolvedValue(listResponse([catalogIpo], 1, 2));
    renderPage();
    await screen.findByRole("link", { name: catalogIpo.company_name });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/ipos/catalog?page=2&page_size=25",
        expect.anything(),
      ),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Search company or exact symbol" }), {
      target: { value: "Catalog" },
    });
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/ipos/catalog?page=1&page_size=25&search=Catalog",
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Open", exact: true }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/ipos/catalog?page=1&page_size=25&search=Catalog&status=OPEN",
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "My IPOs" }));
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/api/ipos?page=1&page_size=25",
        expect.anything(),
      ),
    );
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("loads the same shared catalog in the IPO calendar", async () => {
    apiRequestMock.mockResolvedValue(listResponse());
    renderPage("/ipo-calendar");
    expect(await screen.findByRole("link", { name: catalogIpo.company_name })).toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/api/ipos/catalog?page=1&page_size=25&sort=opening_asc",
      expect.anything(),
    );
  });

  it("shows catalog details without personal edit, archive, or category actions", async () => {
    apiRequestMock.mockResolvedValue({ data: catalogIpo });
    renderPage(`/ipos/catalog/${catalogIpo.id}`);
    expect(
      await screen.findByRole("heading", { name: catalogIpo.company_name }),
    ).toBeInTheDocument();
    expect(screen.getByText("IPO Guru")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit IPO" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Configure categories" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    expect(apiRequestMock).toHaveBeenCalledWith(
      `/api/ipos/catalog/${catalogIpo.id}`,
      expect.anything(),
    );
  });

  it("shows a loading failure without incorrectly reporting an empty catalog", async () => {
    apiRequestMock.mockRejectedValue(new Error("Unavailable"));
    renderPage();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("No IPO records match these filters.")).not.toBeInTheDocument();
  });
});
