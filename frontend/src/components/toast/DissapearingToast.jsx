// Ported from the Laravel project's Components/Toast/DissapearingToast.jsx
// (spelling included -- it is the name every caller and this port use).
//
// Rendered once by ToastProvider, never mounted directly. It shows nothing
// until `message` is non-empty, and the provider clears that after its
// duration, so this component owns no timer of its own.
const TYPES = {
    success: "is-success",
    danger: "is-danger",
    error: "is-danger",
    warning: "is-warning",
    info: "is-info",
};

const DissapearingToast = ({ type, message }) => {
    if (!message) return null;
    return (
        <div className={`toast ${TYPES[type] || "is-info"}`} role="status">
            {message}
        </div>
    );
};

export default DissapearingToast;
