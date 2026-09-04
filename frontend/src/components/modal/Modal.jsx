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
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          {icon && <i className={icon} aria-hidden="true" />}
          <h3 className="modal-title">{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
