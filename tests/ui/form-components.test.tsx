// @vitest-environment jsdom
import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Controller, useForm } from "react-hook-form";
import { FormInput, FormSelect, FormTextarea } from "../../apps/web/src/components/ui/FormControls";
import { FormDrawer } from "../../apps/web/src/components/ui/FormDrawer";
import { SideDrawer } from "../../apps/web/src/components/ui/SideDrawer";
import { SearchableFormSelect } from "../../apps/web/src/components/ui/SearchableFormSelect";
import { Input } from "../../apps/web/src/components/ui/Input";
import { ConfirmButton } from "../../apps/web/src/components/ui/ConfirmButton";

describe("shared form controls", () => {
  it("filters large option lists while retaining the selected record", async () => {
    render(
      <SearchableFormSelect
        label="Account"
        value="1"
        onChange={() => undefined}
        options={Array.from({ length: 10 }, (_, index) => ({
          value: String(index),
          label: `Account ${index}`,
        }))}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Account" }));
    await user.type(screen.getByRole("searchbox"), "Account 9");
    expect(screen.getByRole("combobox", { name: "Account" })).toHaveTextContent("Account 1");
    expect(screen.getByRole("option", { name: /Account 9/ })).toBeInTheDocument();
  });

  it("uses the custom calendar and 24-hour time controls", async () => {
    const dateValues: string[] = [];
    const datetimeValues: string[] = [];
    const dateChange = vi.fn((event: React.ChangeEvent<HTMLInputElement>) => {
      dateValues.push(event.target.value);
    });
    const datetimeChange = vi.fn((event: React.ChangeEvent<HTMLInputElement>) => {
      datetimeValues.push(event.target.value);
    });
    const today = new Date();
    const chosenDate = new Date(today.getFullYear(), today.getMonth(), 15);
    const dateKey = `${chosenDate.getFullYear()}-${String(chosenDate.getMonth() + 1).padStart(2, "0")}-15`;
    const accessibleDate = new Intl.DateTimeFormat(undefined, { dateStyle: "full" }).format(
      chosenDate,
    );
    const user = userEvent.setup();

    const { rerender } = render(
      <Input type="date" aria-label="Opening date" value="" onChange={dateChange} />,
    );
    await user.click(screen.getByRole("combobox", { name: "Opening date" }));
    await user.click(screen.getByRole("button", { name: accessibleDate }));
    expect(dateValues.at(-1)).toBe(dateKey);

    rerender(
      <Input
        type="datetime-local"
        aria-label="Verification time"
        value=""
        onChange={datetimeChange}
      />,
    );
    await user.click(screen.getByRole("combobox", { name: "Verification time" }));
    await user.clear(screen.getByLabelText("Time (24-hour)"));
    await user.type(screen.getByLabelText("Time (24-hour)"), "12:30");
    await user.click(screen.getByRole("button", { name: accessibleDate }));
    expect(datetimeValues.at(-1)).toBe(`${dateKey}T12:30`);
  });

  it("registers input, select and textarea refs and restores loaded values", async () => {
    const saved = vi.fn();
    function Form() {
      const {
        register,
        control,
        reset,
        handleSubmit,
        formState: { errors },
      } = useForm({ defaultValues: { name: "", type: "NSDL", notes: "" } });
      return (
        <form onSubmit={handleSubmit(saved)}>
          <FormInput
            label="Holder"
            error={errors.name?.message}
            {...register("name", { required: "Enter a holder name" })}
          />
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <FormSelect label="Depository" {...field}>
                <option>NSDL</option>
                <option>CDSL</option>
              </FormSelect>
            )}
          />
          <FormTextarea label="Notes" {...register("notes")} />
          <button
            type="button"
            onClick={() => reset({ name: "Loaded holder", type: "CDSL", notes: "Loaded note" })}
          >
            Load
          </button>
          <button>Save</button>
        </form>
      );
    }
    render(<Form />);
    const user = userEvent.setup();
    await user.click(screen.getByText("Save"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a holder name");
    expect(screen.getByLabelText("Holder")).toHaveAccessibleDescription("Enter a holder name");
    expect(screen.getByLabelText("Holder")).toHaveFocus();
    await user.click(screen.getByText("Load"));
    expect(screen.getByLabelText("Holder")).toHaveValue("Loaded holder");
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Depository" })).toHaveTextContent("CDSL"),
    );
    expect(screen.getByLabelText("Notes")).toHaveValue("Loaded note");
    await user.click(screen.getByRole("combobox", { name: "Depository" }));
    await user.click(screen.getByRole("option", { name: "NSDL" }));
    expect(screen.getByRole("combobox", { name: "Depository" })).toHaveTextContent("NSDL");
    await user.type(screen.getByLabelText("Holder"), " edited");
    await user.click(screen.getByText("Save"));
    await waitFor(() =>
      expect(saved).toHaveBeenCalledWith(
        { name: "Loaded holder edited", type: "NSDL", notes: "Loaded note" },
        expect.anything(),
      ),
    );
  });
});

it("keeps a failed confirmation retryable and disables repeated submissions", async () => {
  let rejectAction: (error: Error) => void = () => undefined;
  const action = vi.fn(
    () =>
      new Promise((_, reject) => {
        rejectAction = reject;
      }),
  );
  render(
    <ConfirmButton
      title="Archive record?"
      description="Remove from the active list."
      confirmLabel="Archive"
      onConfirm={action}
    >
      Archive record
    </ConfirmButton>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByText("Archive record"));
  await user.click(screen.getByText("Archive", { exact: true }));
  expect(screen.getByText("Processing…")).toBeDisabled();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  rejectAction(new Error("Please retry."));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please retry.");
  expect(action).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Archive", { exact: true })).toBeEnabled();
});

describe("drawer focus", () => {
  it("does not reset focus or selection when form edits change the close callback", async () => {
    let initialFocusFrame: FrameRequestCallback | undefined;
    const requestFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        initialFocusFrame = callback;
        return 1;
      });
    function Editor() {
      const [name, setName] = useState("");
      const [symbol, setSymbol] = useState("");
      return (
        <SideDrawer
          open
          title="Edit IPO"
          onClose={() => {
            void name;
          }}
        >
          <FormInput
            label="Company"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <FormInput
            label="Symbol"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
          />
        </SideDrawer>
      );
    }
    try {
      render(<Editor />);
      const user = userEvent.setup();
      const symbol = screen.getByLabelText("Symbol") as HTMLInputElement;
      await user.click(symbol);
      await user.type(symbol, "TEST");
      symbol.setSelectionRange(2, 2);
      expect(initialFocusFrame).toBeDefined();
      initialFocusFrame?.(0);
      expect(symbol).toHaveFocus();
      expect(symbol).toHaveValue("TEST");
      expect(symbol.selectionStart).toBe(2);
      expect(symbol.selectionEnd).toBe(2);
      expect(screen.getByLabelText("Company")).toHaveValue("");
      expect(document.body.style.overflow).toBe("hidden");
    } finally {
      requestFrame.mockRestore();
    }
  });

  it("traps the top confirmation, keeps edits on Escape, and restores focus and scroll", async () => {
    function Editor() {
      const [open, setOpen] = useState(false);
      const [value, setValue] = useState("");
      return (
        <>
          <button onClick={() => setOpen(true)}>Add record</button>
          <FormDrawer
            open={open}
            title="Record editor"
            description="Enter details"
            dirty={Boolean(value)}
            onClose={() => setOpen(false)}
            footer={(close) => <button onClick={close}>Cancel</button>}
          >
            <FormInput
              label="Name"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </FormDrawer>
        </>
      );
    }
    render(<Editor />);
    const user = userEvent.setup();
    const trigger = screen.getByText("Add record");
    await user.click(trigger);
    await user.type(screen.getByLabelText("Name"), "Unsaved");
    await user.keyboard("{Escape}");
    const dialog = screen.getByRole("alertdialog");
    await waitFor(() => expect(screen.getByText("Keep editing")).toHaveFocus());
    await user.tab({ shift: true });
    expect(screen.getByText("Discard changes")).toHaveFocus();
    await user.tab();
    expect(screen.getByText("Keep editing")).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Unsaved");
    expect(document.body.style.overflow).toBe("hidden");
    await user.click(screen.getByText("Cancel"));
    await user.click(screen.getByText("Discard changes"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe("");
    expect(trigger.closest("[inert]")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
