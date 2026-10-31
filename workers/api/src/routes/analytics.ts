import { Hono, type Context } from "hono";
import * as XLSX from "@e965/xlsx";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { DashboardAnalytics } from "@ipo-mania/shared";
import {
  dashboardAnalyticsExportQuerySchema,
  dashboardAnalyticsQuerySchema,
} from "@ipo-mania/validation";
import type { EnvironmentBindings } from "../env";
import { authenticate } from "../middleware/authenticate";

type AnalyticsContext = {
  Bindings: EnvironmentBindings;
  Variables: { authenticatedUser: User; rlsSupabase: SupabaseClient };
};
type AnalyticsRouteContext = Context<AnalyticsContext>;
type ReportRow = {
  section: string;
  period: string;
  label: string;
  count: string;
  amount: string;
  capital_blocked: string;
  capital_released: string;
  actual_debit: string;
  refund_received: string;
};

export const analyticsRoutes = new Hono<AnalyticsContext>();
analyticsRoutes.use("*", authenticate);

analyticsRoutes.get("/", async (context) => {
  const parsed = dashboardAnalyticsQuerySchema.safeParse(context.req.query());
  if (!parsed.success) return validationError(context);
  const analytics = await loadAnalytics(context, parsed.data);
  return context.json({ data: analytics });
});

analyticsRoutes.get("/export", async (context) => {
  const parsed = dashboardAnalyticsExportQuerySchema.safeParse(context.req.query());
  if (!parsed.success) return validationError(context);
  const analytics = await loadAnalytics(context, parsed.data);
  const rows = createReportRows(analytics);
  const reportDate = new Date().toISOString().slice(0, 10);

  if (parsed.data.format === "csv") {
    const csv = [
      [
        "section",
        "period",
        "label",
        "count",
        "amount",
        "capital_blocked",
        "capital_released",
        "actual_debit",
        "refund_received",
      ].join(","),
      ...rows.map((row) =>
        [
          row.section,
          row.period,
          row.label,
          row.count,
          row.amount,
          row.capital_blocked,
          row.capital_released,
          row.actual_debit,
          row.refund_received,
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n");
    return context.body(csv, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ipo-mania-analytics-${reportDate}.csv"`,
      "Cache-Control": "private, no-store",
    });
  }

  const workbook = XLSX.utils.book_new();
  for (const [sheetName, sheetRows] of createWorkbookSheets(analytics)) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(sheetRows.map(escapeSpreadsheetRow)),
      sheetName,
    );
  }
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="ipo-mania-analytics-${reportDate}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
});

async function loadAnalytics(
  context: AnalyticsRouteContext,
  query: {
    date_from?: string;
    date_to?: string;
    ipo_id?: string;
    category?: string;
    account_id?: string;
    limit: number;
  },
): Promise<DashboardAnalytics> {
  const { data, error } = await context.get("rlsSupabase").rpc("get_dashboard_analytics", {
    p_date_from: query.date_from ?? null,
    p_date_to: query.date_to ?? null,
    p_ipo_id: query.ipo_id ?? null,
    p_category: query.category ?? null,
    p_account_id: query.account_id ?? null,
    p_limit: query.limit,
  });
  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("The dashboard analytics query returned an invalid response.");
  }
  return data as DashboardAnalytics;
}

function createReportRows(analytics: DashboardAnalytics): ReportRow[] {
  const rows: ReportRow[] = [
    {
      section: "totals",
      period: "",
      label: "Applications",
      count: String(analytics.totals.applications),
      amount: "",
      capital_blocked: "",
      capital_released: "",
      actual_debit: "",
      refund_received: "",
    },
    {
      section: "totals",
      period: "",
      label: "Active demat accounts",
      count: String(analytics.totals.active_demat_accounts),
      amount: "",
      capital_blocked: "",
      capital_released: "",
      actual_debit: "",
      refund_received: "",
    },
    {
      section: "totals",
      period: "",
      label: "Tracked IPOs",
      count: String(analytics.totals.tracked_ipos),
      amount: "",
      capital_blocked: "",
      capital_released: "",
      actual_debit: "",
      refund_received: "",
    },
    ...analytics.applications_by_status.map((item) =>
      reportRow("application status", "", item.status, item.count),
    ),
    ...analytics.applications_by_ipo.map((item) =>
      reportRow("IPO", "", `${item.company_name} (${item.symbol})`, item.count),
    ),
    ...analytics.applications_by_category.map((item) =>
      reportRow("category", "", item.category, item.count),
    ),
    ...analytics.applications_by_account.map((item) =>
      reportRow(
        "demat account",
        "",
        `${item.holder_name} (${item.masked_demat_identifier})`,
        item.count,
      ),
    ),
    ...analytics.applications_by_broker.map((item) =>
      reportRow("broker", "", item.broker_name, item.count),
    ),
    ...analytics.monthly_application_trends.map((item) =>
      reportRow("monthly applications", item.month, "Applications", item.count),
    ),
    ...analytics.capital_utilization_trends.map((item) => ({
      ...emptyReportRow(
        "capital utilization",
        `${item.month} · ${item.currency}`,
        "Ledger event totals",
      ),
      capital_blocked: item.capital_blocked,
      capital_released: item.capital_released,
      actual_debit: item.actual_debit,
      refund_received: item.refund_received,
    })),
    ...analytics.capital_event_totals.flatMap((item) => [
      reportRow("capital totals", "", `${item.currency} capital blocked`, "", item.capital_blocked),
      reportRow("capital totals", "", `${item.currency} actual debit`, "", item.actual_debit),
      reportRow("capital totals", "", `${item.currency} refund received`, "", item.refund_received),
    ]),
    reportRow("allotment", "", "Allotment records", analytics.allotment_performance.total),
    reportRow("allotment", "", "Successful allotments", analytics.allotment_performance.successful),
    reportRow(
      "allotment",
      "",
      "Success rate (%)",
      analytics.allotment_performance.success_rate_percent ?? "Unavailable",
    ),
    reportRow(
      "refund",
      "",
      "Pending refunds",
      analytics.refund_performance.pending,
      analytics.refund_performance.pending_expected_amount,
    ),
    reportRow(
      "refund",
      "",
      "Completed refunds",
      analytics.refund_performance.completed,
      analytics.refund_performance.completed_expected_amount,
    ),
    ...analytics.recent_applications.map((item) =>
      reportRow(
        "recent application",
        item.created_at,
        `${item.company_name} (${item.symbol})`,
        item.status,
      ),
    ),
    ...analytics.upcoming_ipos.map((item) =>
      reportRow(
        "upcoming IPO",
        item.closing_date,
        `${item.company_name} (${item.symbol})`,
        item.status,
      ),
    ),
  ];
  return rows;
}

function createWorkbookSheets(analytics: DashboardAnalytics): Array<[string, object[]]> {
  return [
    [
      "Summary",
      [
        { metric: "Applications", value: analytics.totals.applications },
        { metric: "Active demat accounts", value: analytics.totals.active_demat_accounts },
        { metric: "Tracked IPOs", value: analytics.totals.tracked_ipos },
        { metric: "Allotment records", value: analytics.allotment_performance.total },
        { metric: "Successful allotments", value: analytics.allotment_performance.successful },
        {
          metric: "Allotment success rate (%)",
          value: analytics.allotment_performance.success_rate_percent ?? "Unavailable",
        },
        { metric: "Pending refunds", value: analytics.refund_performance.pending },
        { metric: "Completed refunds", value: analytics.refund_performance.completed },
      ],
    ],
    ["Status", analytics.applications_by_status],
    ["IPO", analytics.applications_by_ipo],
    ["Category", analytics.applications_by_category],
    ["Demat accounts", analytics.applications_by_account],
    ["Brokers", analytics.applications_by_broker],
    ["Monthly applications", analytics.monthly_application_trends],
    ["Capital utilization", analytics.capital_utilization_trends],
    ["Capital totals", analytics.capital_event_totals],
    ["Recent activity", analytics.recent_applications],
    ["Upcoming IPOs", analytics.upcoming_ipos],
  ];
}

function reportRow(
  section: string,
  period: string,
  label: string,
  count: number | string,
  amount = "",
): ReportRow {
  return { ...emptyReportRow(section, period, label), count: String(count), amount };
}

function emptyReportRow(section: string, period: string, label: string): ReportRow {
  return {
    section,
    period,
    label,
    count: "",
    amount: "",
    capital_blocked: "",
    capital_released: "",
    actual_debit: "",
    refund_received: "",
  };
}

function csvCell(value: string): string {
  const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function escapeSpreadsheetRow<T extends object>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value,
    ]),
  ) as T;
}

function validationError(context: AnalyticsRouteContext) {
  return context.json(
    { error: { code: "VALIDATION_ERROR", message: "Dashboard filters are invalid." } },
    400,
  );
}
