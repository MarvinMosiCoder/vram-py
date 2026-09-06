import { useEffect } from "react";

// A single generic dialog primitive. The Laravel original splits this into
// Modal.jsx and Modalv2.jsx (two confirmation styles); one flexible
// component covers both call sites this project actually has.
const Modal = ({ show, onClose, title, icon, children }) => {
  useEffect(() => {
    if (!show) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={onClose}
    >
      <div
        className="flex w-full max-w-[420px] flex-col gap-3.5 rounded-[10px] border border-skin-border bg-skin-panel p-5"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5">
          {icon && <i className={`${icon} text-skin-accent`} aria-hidden="true" />}
          <h3 className="m-0 flex-1 text-[15px]">{title}</h3>
          <button
            type="button"
            className="!mt-0 !h-auto !w-auto border-0 !bg-transparent px-1 text-lg leading-none !text-skin-dim hover:!bg-transparent hover:!text-skin-text"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
