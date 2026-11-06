// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardChartTooltip } from "../../apps/web/src/pages/DashboardPage";

describe("dashboard chart tooltips", () => {
  it.each([
    {
      kind: "status" as const,
      row: { status: "SUBMITTED" },
      details: ["Submitted"],
    },
    {
      kind: "ipo" as const,
      row: { company_name: "Dashboard Test IPO", symbol: "DASH" },
      details: ["Dashboard Test IPO", "Symbol: DASH"],
    },
    {
      kind: "category" as const,
      row: { category: "RETAIL" },
      details: ["RETAIL"],
    },
    {
      kind: "month" as const,
      row: { month: "2026-10" },
      details: ["October 2026"],
    },
    {
      kind: "account" as const,
      row: { bank_name: "Dashboard Bank", holder_name: "Dashboard Holder" },
      details: ["Dashboard Bank", "Account holder: Dashboard Holder"],
    },
  ])("shows correct details for the $kind chart", ({ kind, row, details }) => {
    render(<DashboardChartTooltip active kind={kind} payload={[{ value: 1, payload: row }]} />);

    for (const detail of details) expect(screen.getByText(detail)).toBeInTheDocument();
    expect(screen.getByText("Application:").parentElement).toHaveTextContent("Application: 1");
  });

  it("uses the plural application label and hides when no chart item is active", () => {
    const { rerender } = render(
      <DashboardChartTooltip
        active
        kind="status"
        payload={[{ value: 2, payload: { status: "DRAFT" } }]}
      />,
    );

    expect(screen.getByText("Applications:").parentElement).toHaveTextContent("Applications: 2");
    rerender(<DashboardChartTooltip kind="status" payload={[{ value: 2 }]} />);
    expect(screen.queryByText("Applications:")).not.toBeInTheDocument();
  });
});
