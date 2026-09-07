// Ported from the Laravel project's Components/Toast/DissapearingToast.jsx
// (spelling included -- it is the name every caller and this port use).
//
// Rendered once by ToastProvider, never mounted directly. It shows nothing
// until `message` is non-empty, and the provider clears that after its
// duration, so this component owns no timer of its own.
const TYPES = {
    success: "border-skin-accent-dim text-skin-accent",
    danger: "border-skin-danger/45 text-skin-danger",
    error: "border-skin-danger/45 text-skin-danger",
    warning: "border-amber-500/45 text-amber-600",
    info: "border-skin-border text-skin-text",
};

const DissapearingToast = ({ type, message }) => {
    if (!message) return null;
    return (
        <div className={`flex items-center gap-3 rounded-lg border bg-skin-panel px-3.5 py-2.5 text-[13px] ${TYPES[type] || "border-skin-border text-skin-text"}`} role="status">
            {message}
        </div>
    );
};

export default DissapearingToast;
