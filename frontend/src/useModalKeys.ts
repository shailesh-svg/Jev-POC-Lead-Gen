import { useEffect, useRef } from "react";

const FOCUSABLE =
  '[role="dialog"] button:not(:disabled), [role="dialog"] input:not(:disabled), [role="dialog"] textarea:not(:disabled), [role="dialog"] select:not(:disabled)';

/**
 * Dialog keyboard behaviour: Escape closes, Tab cycles inside the dialog, and
 * focus returns to whatever opened it. `locked` blocks Escape while a request
 * is in flight. The close callback is held in a ref so re-renders do not
 * re-run the effect and steal focus.
 */
export function useModalKeys(open: boolean, locked: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !locked) {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [open, locked]);
}
