/* eslint-disable react-refresh/only-export-components -- route declarations are not hot-reload components */
import { lazy } from "react";
import { createBrowserRouter, Navigate, redirect } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { ListTabRedirect } from "../components/layout/ListTabRedirect";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ProtectedRoute } from "../auth/ProtectedRoute";

const RegisterPage = lazy(() =>
  import("../pages/RegisterPage").then((m) => ({ default: m.RegisterPage })),
);
const LoginPage = lazy(() => import("../pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() =>
  import("../pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import("../pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);
const ConfirmEmailPage = lazy(() =>
  import("../pages/ConfirmEmailPage").then((m) => ({ default: m.ConfirmEmailPage })),
);
const ProfilePage = lazy(() =>
  import("../pages/ProfilePage").then((m) => ({ default: m.ProfilePage })),
);
const DashboardHomePage = lazy(() =>
  import("../pages/DashboardPage").then((m) => ({ default: m.DashboardHomePage })),
);
const AccountDashboardPage = lazy(() =>
  import("../pages/accounts/AccountPages").then((m) => ({ default: m.AccountDashboardPage })),
);
const AccountDetailsPage = lazy(() =>
  import("../pages/accounts/AccountPages").then((m) => ({ default: m.AccountDetailsPage })),
);
const AccountFormPage = lazy(() =>
  import("../pages/accounts/AccountPages").then((m) => ({ default: m.AccountFormPage })),
);
const ImportHistoryPage = lazy(() =>
  import("../pages/accounts/AccountPages").then((m) => ({ default: m.ImportHistoryPage })),
);
const AdminHistoryPage = lazy(() =>
  import("../pages/admin/AdminPages").then((m) => ({ default: m.AdminHistoryPage })),
);
const AdminIposPage = lazy(() =>
  import("../pages/admin/AdminPages").then((m) => ({ default: m.AdminIposPage })),
);
const AdminLayout = lazy(() =>
  import("../pages/admin/AdminPages").then((m) => ({ default: m.AdminLayout })),
);
const AdminOverviewPage = lazy(() =>
  import("../pages/admin/AdminPages").then((m) => ({ default: m.AdminOverviewPage })),
);
const AdminRoute = lazy(() =>
  import("../pages/admin/AdminPages").then((m) => ({ default: m.AdminRoute })),
);
const AdminSettingsPage = lazy(() =>
  import("../pages/admin/AdminPages").then((m) => ({ default: m.AdminSettingsPage })),
);
const AdminSyncPage = lazy(() =>
  import("../pages/admin/AdminPages").then((m) => ({ default: m.AdminSyncPage })),
);
const IpoCatalogApplicationsPage = lazy(() =>
  import("../pages/ipos/IpoPages").then((m) => ({ default: m.IpoCatalogApplicationsPage })),
);
const IpoCatalogDetailsPage = lazy(() =>
  import("../pages/ipos/IpoPages").then((m) => ({ default: m.IpoCatalogDetailsPage })),
);
const IpoCategoryConfigurationPage = lazy(() =>
  import("../pages/ipos/IpoPages").then((m) => ({ default: m.IpoCategoryConfigurationPage })),
);
const IpoDetailsPage = lazy(() =>
  import("../pages/ipos/IpoPages").then((m) => ({ default: m.IpoDetailsPage })),
);
const IpoListPage = lazy(() =>
  import("../pages/ipos/IpoPages").then((m) => ({ default: m.IpoListPage })),
);
const QuotaCalculatorPage = lazy(() =>
  import("../pages/ipos/IpoPages").then((m) => ({ default: m.QuotaCalculatorPage })),
);
const ApplicationDashboardPage = lazy(() =>
  import("../pages/applications/ApplicationPages").then((m) => ({
    default: m.ApplicationDashboardPage,
  })),
);
const ApplicationDetailsPage = lazy(() =>
  import("../pages/applications/ApplicationPages").then((m) => ({
    default: m.ApplicationDetailsPage,
  })),
);
const ApplicationFormPage = lazy(() =>
  import("../pages/applications/ApplicationPages").then((m) => ({
    default: m.ApplicationFormPage,
  })),
);
const ApplicationImportHistoryPage = lazy(() =>
  import("../pages/applications/ApplicationPages").then((m) => ({
    default: m.ApplicationImportHistoryPage,
  })),
);
const ApplicationImportPage = lazy(() =>
  import("../pages/applications/ApplicationPages").then((m) => ({
    default: m.ApplicationImportPage,
  })),
);
const BulkApplicationPage = lazy(() =>
  import("../pages/applications/ApplicationPages").then((m) => ({
    default: m.BulkApplicationPage,
  })),
);

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
      {
        path: "ipos/:ipoId/categories",
        element: <IpoCategoryConfigurationPage sharedCatalog />,
      },
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
      { path: "accounts/list", element: <ListTabRedirect path="/accounts" /> },
      { path: "accounts/new", element: protectedPage(<AccountFormPage />) },
      {
        path: "accounts/import",
        element: <Navigate replace to="/accounts?accountImport=true" />,
      },
      { path: "accounts/import-history", element: protectedPage(<ImportHistoryPage />) },
      {
        path: "accounts/import-history/:importId",
        element: protectedPage(<ImportHistoryPage />),
      },
      { path: "accounts/:accountId/edit", element: protectedPage(<AccountFormPage editing />) },
      { path: "accounts/:accountId", element: protectedPage(<AccountDetailsPage />) },
      { path: "ipos", element: protectedPage(<IpoListPage />) },
      {
        path: "ipo-calendar",
        loader: ({ request }) => redirect(`/ipos${new URL(request.url).search}`),
      },
      { path: "ipos/new", element: <Navigate replace to="/ipos" /> },
      {
        path: "ipos/catalog/:ipoId/applications",
        element: protectedPage(<IpoCatalogApplicationsPage />),
      },
      { path: "ipos/catalog/:ipoId", element: protectedPage(<IpoCatalogDetailsPage />) },
      {
        path: "ipos/:ipoId/edit",
        loader: ({ params }) => redirect(`/ipos/${params.ipoId}`),
      },
      { path: "ipos/:ipoId/categories", element: protectedPage(<IpoCategoryConfigurationPage />) },
      { path: "ipos/:ipoId", element: protectedPage(<IpoDetailsPage />) },
      { path: "quota-calculator", element: protectedPage(<QuotaCalculatorPage />) },
      { path: "applications", element: protectedPage(<ApplicationDashboardPage />) },
      { path: "applications/list", element: <ListTabRedirect path="/applications" /> },
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
