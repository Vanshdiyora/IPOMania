// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToastProvider } from "../../apps/web/src/components/ui/Toast";
import { useToast } from "../../apps/web/src/components/ui/ToastContext";

function ToastTrigger() {
  const { notify } = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        notify({
          title: "Record created",
          description: "Your record is ready.",
          tone: "success",
        })
      }
    >
      Create record
    </button>
  );
}

describe("toast notifications", () => {
  it("announces action feedback and allows dismissal", async () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByText("Record created")).toBeInTheDocument();
    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("p-3", "pr-2");
    expect(toast.querySelector(".flex")).toHaveClass("items-center");
    expect(toast.parentElement).toHaveClass("inset-x-3", "top-3", "sm:right-5");
    expect(screen.getByText("Your record is ready.")).toBeInTheDocument();
    const dismissButton = screen.getByRole("button", { name: "Dismiss notification" });
    expect(dismissButton).toHaveClass("min-h-touch", "min-w-touch");
    fireEvent.click(dismissButton);
    expect(screen.queryByText("Record created")).not.toBeInTheDocument();
  });
});
