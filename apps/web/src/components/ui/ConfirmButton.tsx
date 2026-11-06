import { useState, type ReactNode } from "react";
import { Button, type ButtonProps } from "./Button";
import { ConfirmationDialog } from "./ConfirmationDialog";

export function ConfirmButton({
  title,
  description,
  confirmLabel,
  danger = true,
  onConfirm,
  ...props
}: Omit<ButtonProps, "onClick" | "title"> & {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => unknown | Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReactNode>(null);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The action could not be completed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        {...props}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      />
      <ConfirmationDialog
        open={open}
        title={title}
        description={
          <>
            {description}
            {error && (
              <p role="alert" className="mt-3 text-danger">
                {error}
              </p>
            )}
          </>
        }
        confirmLabel={busy ? "Processing" : confirmLabel}
        busy={busy}
        danger={danger}
        onCancel={() => setOpen(false)}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
