import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { NotFoundPage } from "../pages/NotFoundPage";
import { RegisterPage } from "../pages/RegisterPage";
import { LoginPage } from "../pages/LoginPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { ConfirmEmailPage } from "../pages/ConfirmEmailPage";
import { ProfilePage } from "../pages/ProfilePage";
import { DashboardHomePage } from "../pages/DashboardPage";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import {
  AccountDashboardPage,
  AccountDetailsPage,
  AccountFormPage,
  AccountImportPage,
  AccountListPage,
  ImportHistoryPage,
} from "../pages/accounts/AccountPages";
import {
  AdminHistoryPage,
  AdminIposPage,
  AdminLayout,
  AdminOverviewPage,
  AdminRoute,
  AdminSettingsPage,
  AdminSyncPage,
} from "../pages/admin/AdminPages";
import {
  IpoCategoryConfigurationPage,
  IpoDetailsPage,
  IpoFormPage,
  IpoListPage,
  QuotaCalculatorPage,
} from "../pages/ipos/IpoPages";
import {
  ApplicationDashboardPage,
  ApplicationDetailsPage,
  ApplicationFormPage,
  ApplicationImportHistoryPage,
  ApplicationImportPage,
  ApplicationListPage,
  BulkApplicationPage,
} from "../pages/applications/ApplicationPages";
import {
  AllotmentDashboardPage,
  AllotmentDetailsPage,
  CapitalTrackerPage,
  CreateAllotmentPage,
  CreateMandatePage,
  FinancialTransactionHistoryPage,
  MandateDashboardPage,
  MandateDetailsPage,
  RefundTrackerPage,
} from "../pages/capital/CapitalPages";

function protectedPage(element: React.ReactNode) {
  return <ProtectedRoute>{element}</ProtectedRoute>;
}

export const router = createBrowserRouter([
  { path: "/register", element: <RegisterPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/auth/confirm", element: <ConfirmEmailPage /> },
  {
    path: "/admin",
    element: (
      <AdminRoute>
        <AdminLayout />
      </AdminRoute>
    ),
    children: [
      { index: true, element: <AdminOverviewPage /> },
      { path: "ipos", element: <AdminIposPage /> },
      { path: "sync", element: <AdminSyncPage /> },
      { path: "ipo-sync-history", element: <AdminHistoryPage /> },
      { path: "settings", element: <AdminSettingsPage /> },
    ],
  },
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <DashboardHomePage /> },
      { path: "dashboard", element: protectedPage(<DashboardHomePage />) },
      { path: "accounts", element: protectedPage(<AccountDashboardPage />) },
      { path: "accounts/list", element: protectedPage(<AccountListPage />) },
      { path: "accounts/new", element: protectedPage(<AccountFormPage />) },
      { path: "accounts/import", element: protectedPage(<AccountImportPage />) },
      { path: "accounts/import-history", element: protectedPage(<ImportHistoryPage />) },
      {
        path: "accounts/import-history/:importId",
        element: protectedPage(<ImportHistoryPage />),
      },
      { path: "accounts/:accountId/edit", element: protectedPage(<AccountFormPage editing />) },
      { path: "accounts/:accountId", element: protectedPage(<AccountDetailsPage />) },
      { path: "ipos", element: protectedPage(<IpoListPage />) },
      { path: "ipo-calendar", element: protectedPage(<IpoListPage calendar />) },
      { path: "ipos/new", element: protectedPage(<IpoFormPage />) },
      { path: "ipos/:ipoId/edit", element: protectedPage(<IpoFormPage editing />) },
      { path: "ipos/:ipoId/categories", element: protectedPage(<IpoCategoryConfigurationPage />) },
      { path: "ipos/:ipoId", element: protectedPage(<IpoDetailsPage />) },
      { path: "quota-calculator", element: protectedPage(<QuotaCalculatorPage />) },
      { path: "mandates", element: protectedPage(<MandateDashboardPage />) },
      { path: "mandates/new", element: protectedPage(<CreateMandatePage />) },
      { path: "mandates/:mandateId", element: protectedPage(<MandateDetailsPage />) },
      { path: "allotments", element: protectedPage(<AllotmentDashboardPage />) },
      { path: "allotments/new", element: protectedPage(<CreateAllotmentPage />) },
      { path: "allotments/:allotmentId", element: protectedPage(<AllotmentDetailsPage />) },
      { path: "capital", element: protectedPage(<CapitalTrackerPage />) },
      {
        path: "capital/transactions",
        element: protectedPage(<FinancialTransactionHistoryPage />),
      },
      { path: "capital/refunds", element: protectedPage(<RefundTrackerPage />) },
      { path: "applications", element: protectedPage(<ApplicationDashboardPage />) },
      { path: "applications/list", element: protectedPage(<ApplicationListPage />) },
      { path: "applications/new", element: protectedPage(<ApplicationFormPage />) },
      { path: "applications/bulk", element: protectedPage(<BulkApplicationPage />) },
      { path: "applications/import", element: protectedPage(<ApplicationImportPage />) },
      {
        path: "applications/import-history",
        element: protectedPage(<ApplicationImportHistoryPage />),
      },
      {
        path: "applications/import-history/:importId",
        element: protectedPage(<ApplicationImportHistoryPage />),
      },
      {
        path: "applications/:applicationId/edit",
        element: protectedPage(<ApplicationFormPage editing />),
      },
      { path: "applications/:applicationId", element: protectedPage(<ApplicationDetailsPage />) },
      {
        path: "profile",
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
