// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";
import { ConfirmEmailPage } from "../../apps/web/src/pages/ConfirmEmailPage";
import { ResetPasswordPage } from "../../apps/web/src/pages/ResetPasswordPage";

vi.mock("../../apps/web/src/auth/useAuth", () => ({
  useAuth: () => ({ configurationError: null }),
}));

function renderAuthPage(page: React.ReactNode) {
  render(
    <React.StrictMode>
      <ToastProvider>
        <MemoryRouter>{page}</MemoryRouter>
      </ToastProvider>
    </React.StrictMode>,
  );
}

describe("authentication notifications", () => {
  it("announces an invalid verification link once", async () => {
    renderAuthPage(<ConfirmEmailPage />);
    expect(await screen.findAllByText("Email verification failed")).toHaveLength(1);
  });

  it("announces an invalid reset link once", async () => {
    renderAuthPage(<ResetPasswordPage />);
    expect(await screen.findAllByText("Password reset link is invalid")).toHaveLength(1);
  });
});
