// Stands in for the Laravel template's global toast helper, which
// GeneratedModulePage called as handleToast(message, status).
//
// Deliberately dumb: it renders, it does not own a queue or a timer. The page
// holds the message state and clears it, so there is no hidden global.
const Toast = ({ message, status = "success", onDismiss }) => {
    if (!message) return null;
    return (
        <div className={`flex items-center gap-3 rounded-lg border bg-skin-panel px-3.5 py-2.5 text-[13px] ${status === "success" ? "border-skin-accent-dim text-skin-accent" : "border-skin-danger/45 text-skin-danger"}`} role="status">
            {message}
            {onDismiss && (
                <button type="button" className="ml-auto w-auto cursor-pointer border-0 bg-transparent px-1 py-0 text-lg leading-none text-inherit hover:opacity-70" onClick={onDismiss} aria-label="Dismiss">
                    ×
                </button>
            )}
        </div>
    );
};
export default Toast;
