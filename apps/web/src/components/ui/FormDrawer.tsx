import { useEffect, useRef, useState, type ReactNode } from "react";
import { useBlocker, useNavigate } from "react-router-dom";
import { Button } from "./Button";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { SideDrawer } from "./SideDrawer";

type FormDrawerProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode | ((requestClose: () => void) => ReactNode);
  dirty: boolean;
  busy?: boolean;
  open?: boolean;
  onClose: () => void;
};

function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
}

export function FormDrawer({
  dirty,
  busy = false,
  onClose,
  open = true,
  footer,
  ...props
}: FormDrawerProps) {
  const [discardOpen, setDiscardOpen] = useState(false);
  useUnsavedChangesWarning(open && dirty);
  const close = () => {
    if (busy) return;
    if (dirty) setDiscardOpen(true);
    else onClose();
  };
  return (
    <>
      <SideDrawer
        {...props}
        open={open}
        busy={busy}
        onClose={close}
        footer={typeof footer === "function" ? footer(close) : footer}
      />
      <ConfirmationDialog
        open={open && discardOpen}
        title="Discard unsaved changes?"
        description="Your changes will be lost if you close this drawer."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        danger
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          onClose();
        }}
      />
    </>
  );
}

// Route-backed forms keep their existing deep links and browser back behavior.
export function RouteFormDrawer({
  title,
  description,
  cancelTo,
  formId,
  submitLabel,
  busy = false,
  disabled = false,
  dirty,
  children,
}: {
  title: string;
  description: string;
  cancelTo: string;
  formId: string;
  submitLabel: string;
  busy?: boolean;
  disabled?: boolean;
  dirty: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  const leave = (action: () => void) => {
    if (closeTimer.current !== undefined) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(action, 180);
  };
  const requestClose = () => {
    if (dirty) navigate(cancelTo);
    else leave(() => navigate(cancelTo));
  };
  useUnsavedChangesWarning(dirty);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !busy && currentLocation.pathname !== nextLocation.pathname,
  );
  return (
    <>
      <SideDrawer
        open={!closing}
        title={title}
        description={description}
        busy={busy || closing}
        onClose={requestClose}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" disabled={busy || closing} onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={busy} disabled={disabled || closing}>
              {busy ? "Saving…" : submitLabel}
            </Button>
          </div>
        }
      >
        {children}
      </SideDrawer>
      <ConfirmationDialog
        open={blocker.state === "blocked" && !closing}
        title="Discard unsaved changes?"
        description="Your changes will be lost if you leave this form."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        danger
        onCancel={() => blocker.reset?.()}
        onConfirm={() => leave(() => blocker.proceed?.())}
      />
    </>
  );
}
