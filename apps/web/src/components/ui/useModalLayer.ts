import { useEffect, useRef, type RefObject } from "react";

const layers: HTMLElement[] = [];
let unlockedOverflow = "";
let rootFocus: HTMLElement | null = null;
const inertLocks = new Map<HTMLElement, { count: number; original: boolean }>();
const focusableSelector =
  'button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

// Callbacks can change while typing. Only opening/closing a layer should move focus.
export function useModalLayer(
  open: boolean,
  panelRef: RefObject<HTMLElement>,
  onClose: () => void,
  initialFocus = "[data-initial-focus], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (!layers.length) {
      unlockedOverflow = document.body.style.overflow;
      rootFocus = previousFocus;
    }
    const inertElements = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && !element.contains(panel),
      )
      .map((element) => ({ element, inert: element.hasAttribute("inert") }));
    inertElements.forEach(({ element, inert }) => {
      const lock = inertLocks.get(element) ?? { count: 0, original: inert };
      lock.count += 1;
      inertLocks.set(element, lock);
      element.setAttribute("inert", "");
    });
    document.body.style.overflow = "hidden";
    layers.push(panel);
    const frame = requestAnimationFrame(() => {
      if (layers.at(-1) === panel)
        (
          panel.querySelector<HTMLElement>(initialFocus) ??
          panel.querySelector<HTMLElement>("button:not(:disabled)") ??
          panel
        ).focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (layers.at(-1) !== panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) =>
          !element.closest("[inert], [hidden]") && element.getAttribute("aria-hidden") !== "true",
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        panel.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      const index = layers.indexOf(panel);
      if (index !== -1) layers.splice(index, 1);
      inertElements.forEach(({ element }) => {
        const lock = inertLocks.get(element);
        if (!lock) return;
        lock.count -= 1;
        if (!lock.count) {
          if (!lock.original) element.removeAttribute("inert");
          inertLocks.delete(element);
        }
      });
      document.body.style.overflow = layers.length ? "hidden" : unlockedOverflow;
      const focusTarget = layers.length ? previousFocus : rootFocus;
      if (focusTarget?.isConnected && !focusTarget.closest("[inert]")) focusTarget.focus();
    };
  }, [open, panelRef, initialFocus]);
}
