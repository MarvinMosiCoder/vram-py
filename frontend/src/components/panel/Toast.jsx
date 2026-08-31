// Stands in for the Laravel template's global toast helper, which
// GeneratedModulePage called as handleToast(message, status).
//
// Deliberately dumb: it renders, it does not own a queue or a timer. The page
// holds the message state and clears it, so there is no hidden global.
const Toast = ({ message, status = "success", onDismiss }) => {
    if (!message) return null;
    return (
        <div className={`toast is-${status === "success" ? "success" : "danger"}`} role="status">
            {message}
            {onDismiss && (
                <button type="button" className="toast-close" onClick={onDismiss} aria-label="Dismiss">
                    ×
                </button>
            )}
        </div>
    );
};
export default Toast;
