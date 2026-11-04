// @vitest-environment jsdom

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "../../apps/web/src/lib/api";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";
import { ApplicationDetailsPage } from "../../apps/web/src/pages/applications/ApplicationPages";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("../../apps/web/src/auth/useAuth", () => ({
  useAuth: () => ({ session: { access_token: "regular-user-token" } }),
}));
vi.mock("../../apps/web/src/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  apiRequest: apiRequestMock,
}));

const applicationId = "88888888-8888-4888-8888-888888888888";
const record = {
  id: applicationId,
  user_id: "user-id",
  ipo_id: "ipo-id",
  demat_account_id: "account-id",
  category_id: "category-id",
  category_code: "RETAIL",
  lots: 1,
  total_shares: 1200,
  application_amount: "112800",
  application_number: "APP-2026-001",
  external_reference: "REF-123",
  submission_date: "2026-11-04T11:09:35.680Z",
  application_status: "SUBMITTED",
  mandate_status: "PENDING",
  allotment_status: "UNKNOWN",
  notes: "Submitted through my bank",
  rule_version: 3,
  calculation_snapshot: {
    captured_at: "2026-11-04T11:09:35.680Z",
    ipo: {
      lot_size: 1200,
      issue_price_min: "94",
      issue_price_max: "94",
      cut_off_price: "94",
    },
    calculation_input: {
      lots: 1,
      price: "94",
      category: "RETAIL",
      price_type: "BID",
    },
    category_configuration: {
      minimum_lots: 1,
      maximum_lots: 10,
      lot_increment: 1,
      minimum_investment: null,
      maximum_investment: "200000",
    },
    calculation_result: { total_shares: 1200, application_amount: "112800" },
  },
  created_at: "2026-11-04T11:09:35.680Z",
  updated_at: "2026-11-04T11:09:35.680Z",
  archived_at: null,
  ipos: { company_name: "Vedant Poly Fabs", symbol: null },
  demat_accounts: { holder_name: "Vansh", bank_name: "Example Bank", username: "vansh" },
  ipo_categories: { category: "RETAIL" },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ToastProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/applications/${applicationId}`]}>
          <Routes>
            <Route path="/applications/:applicationId" element={<ApplicationDetailsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>,
  );
}

describe("application details", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ data: record });
  });

  it("shows a readable application summary and calculation details instead of the raw snapshot", async () => {
    renderPage();

    expect(await screen.findAllByText("Vedant Poly Fabs")).toHaveLength(2);
    expect(screen.getByText("₹1,12,800.00")).toBeInTheDocument();
    expect(screen.getByText("1", { selector: "p" })).toBeInTheDocument();
    expect(screen.getAllByText("1,200")).toHaveLength(2);
    expect(screen.getByText("Submitted through my bank")).toBeInTheDocument();
    expect(screen.getAllByText("Submitted").length).toBeGreaterThan(0);
    expect(screen.queryByText("APP-2026-001")).toBeNull();
    expect(screen.queryByText("Application number")).toBeNull();
    expect(screen.queryByText("REF-123")).toBeNull();
    expect(screen.queryByText("External reference")).toBeNull();
    expect(screen.queryByText("Rule version")).toBeNull();
    expect(screen.queryByText("Application progress")).toBeNull();
    expect(screen.queryByText(/calculation_input|category_configuration|captured_at/)).toBeNull();
    expect(screen.queryByText(applicationId)).toBeNull();

    fireEvent.click(screen.getByText("Calculation details"));

    expect(screen.getByText("Bid price")).toBeInTheDocument();
    expect(screen.getByText("₹94.00 – ₹94.00")).toBeInTheDocument();
    expect(screen.getByText("Maximum investment")).toBeInTheDocument();
    expect(screen.getByText("₹2,00,000.00")).toBeInTheDocument();
  });

  it("keeps details usable when older records have no related names or calculation snapshot", async () => {
    apiRequestMock.mockResolvedValue({
      data: {
        ...record,
        ipos: undefined,
        demat_accounts: undefined,
        calculation_snapshot: {},
        rule_version: null,
      },
    });

    renderPage();

    expect(await screen.findAllByText("IPO details unavailable")).toHaveLength(2);
    expect(screen.getAllByText("Demat account").length).toBeGreaterThan(0);
    expect(screen.queryByText("ipo-id")).toBeNull();
    expect(screen.queryByText("account-id")).toBeNull();
    fireEvent.click(screen.getByText("Calculation details"));
    expect(screen.getAllByText("Not recorded").length).toBeGreaterThan(0);
  });
});
