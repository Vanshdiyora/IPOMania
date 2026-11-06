import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Link, useBlocker, useNavigate, type LinkProps } from "react-router-dom";
import { Button } from "./Button";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { SideDrawer } from "./SideDrawer";

type DrawerRouteContextValue = {
  open: (path: string) => void;
  close: () => void;
  isLocal: boolean;
};

const DrawerRouteContext = createContext<DrawerRouteContextValue | null>(null);

export function DrawerRouteProvider({
  value,
  children,
}: {
  value: DrawerRouteContextValue;
  children: ReactNode;
}) {
  return <DrawerRouteContext.Provider value={value}>{children}</DrawerRouteContext.Provider>;
}

export function DrawerRouteLink({ to, onClick, ...props }: Omit<LinkProps, "to"> & { to: string }) {
  const drawerRoute = useContext(DrawerRouteContext);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      props.target
    ) {
      return;
    }

    if (drawerRoute) {
      event.preventDefault();
      drawerRoute.open(to);
    }
  }

  return <Link {...props} to={to} onClick={handleClick} />;
}

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
  const drawerRoute = useContext(DrawerRouteContext);
  const [closing, setClosing] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const closeTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  const leave = (action: () => void) => {
    if (closeTimer.current !== undefined) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(action, 180);
  };
  const requestClose = () => {
    if (drawerRoute?.isLocal) {
      if (busy) return;
      if (dirty) setDiscardOpen(true);
      else leave(drawerRoute.close);
      return;
    }
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
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-end">
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              disabled={busy || closing}
              onClick={requestClose}
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              type="submit"
              form={formId}
              loading={busy}
              disabled={disabled || closing}
            >
              {busy ? "Saving" : submitLabel}
            </Button>
          </div>
        }
      >
        {children}
      </SideDrawer>
      <ConfirmationDialog
        open={
          (blocker.state === "blocked" || Boolean(drawerRoute?.isLocal && discardOpen)) && !closing
        }
        title="Discard unsaved changes?"
        description="Your changes will be lost if you leave this form."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        danger
        onCancel={() => {
          setDiscardOpen(false);
          blocker.reset?.();
        }}
        onConfirm={() => {
          if (drawerRoute?.isLocal) {
            setDiscardOpen(false);
            leave(drawerRoute.close);
          } else {
            leave(() => blocker.proceed?.());
          }
        }}
      />
    </>
  );
}
