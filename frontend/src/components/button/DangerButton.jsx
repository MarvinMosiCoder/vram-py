// Breeze's DangerButton, for destructive confirmations.
const DangerButton = ({ children, className = "", disabled, type = "button", ...props }) => {
    return (
        <button
            type={type}
            disabled={disabled}
            className={`btn btn-danger ${className}`.trim()}
            {...props}
        >
            {children}
        </button>
    );
};
export default DangerButton;
