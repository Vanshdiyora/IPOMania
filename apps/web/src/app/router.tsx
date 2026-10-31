import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { NotFoundPage } from "../pages/NotFoundPage";
import { WelcomePage } from "../pages/WelcomePage";
import { RegisterPage } from "../pages/RegisterPage";
import { LoginPage } from "../pages/LoginPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { ConfirmEmailPage } from "../pages/ConfirmEmailPage";
import { ProfilePage } from "../pages/ProfilePage";
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
  IpoCategoryConfigurationPage,
  IpoDetailsPage,
  IpoFormPage,
  IpoListPage,
  QuotaCalculatorPage,
} from "../pages/ipos/IpoPages";

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
    path: "/",
    element: <AppLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <WelcomePage /> },
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
