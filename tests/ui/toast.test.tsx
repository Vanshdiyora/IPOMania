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
    expect(screen.getByText("Your record is ready.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Record created")).not.toBeInTheDocument();
  });
});
