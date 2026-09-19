import type { ReactNode } from "react";

/**
 * Dialog shell: clicking the backdrop closes it, unless a request is in
 * flight. Keyboard behaviour lives in useModalKeys, which the owning
 * component wires up alongside this.
 */
export function Modal({
  labelledBy,
  variant,
  locked,
  onClose,
  children,
}: {
  labelledBy: string;
  variant?: string;
  locked: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !locked) onClose();
      }}
    >
      <section
        className={"modal" + (variant ? " " + variant : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </section>
    </div>
  );
}
