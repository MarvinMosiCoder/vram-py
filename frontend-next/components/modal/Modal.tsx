"use client";

import { useEffect, type ReactNode } from "react";

// A single generic dialog primitive. The Laravel original splits this into
// Modal.jsx and Modalv2.jsx (two confirmation styles); one flexible
// component covers both call sites this project actually has.
const Modal = ({
  show,
  onClose,
  title,
  icon,
  children,
  // A forced dialog opts out of every dismissal route: Escape, the backdrop,
  // and the close button. Defaults keep every existing call site unchanged.
  dismissible = true,
  widthClass = "max-w-105",
}: { show: boolean; onClose?: () => void; title: string; icon?: string; children: ReactNode; dismissible?: boolean; widthClass?: string }) => {
  useEffect(() => {
    if (!show || !dismissible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [show, onClose, dismissible]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={dismissible ? onClose : undefined}
    >
      <div
        className={`flex w-full ${widthClass} flex-col gap-3.5 rounded-[10px] border border-skin-border bg-skin-panel p-5`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          {icon && <i className={`${icon} text-skin-accent`} aria-hidden="true" />}
          <h3 className="m-0 flex-1 text-[15px]">{title}</h3>
          {dismissible && (
            <button
              type="button"
              className="mt-0! h-auto! w-auto! border-0 bg-transparent! px-1 text-lg leading-none text-skin-dim! hover:bg-transparent! hover:text-skin-text!"
              onClick={onClose}
              aria-label="Close"
            >
              &times;
            </button>
          )}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
