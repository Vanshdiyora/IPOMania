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
    expect(toast).toHaveClass("px-3", "py-2", "sm:p-3", "sm:pr-2");
    expect(toast.querySelector(".flex")).toHaveClass("items-center");
    expect(toast.parentElement).toHaveClass(
      "inset-x-3",
      "bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]",
      "flex-col-reverse",
      "sm:bottom-auto",
      "sm:top-4",
      "sm:right-5",
      "sm:flex-col",
    );
    expect(screen.getByText("Your record is ready.")).toBeInTheDocument();
    const dismissButton = screen.getByRole("button", { name: "Dismiss notification" });
    expect(dismissButton).toHaveClass("min-h-touch", "min-w-touch");
    fireEvent.click(dismissButton);
    expect(screen.queryByText("Record created")).not.toBeInTheDocument();
  });
});
