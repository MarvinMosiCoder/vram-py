// Laravel Breeze's PrimaryButton, ported. The `button` element rule in
// index.css already paints the accent fill, so this mostly exists to give
// pages a named component instead of a bare <button>.
const PrimaryButton = ({ children, className = "", disabled, type = "submit", ...props }) => {
    return (
        <button
            type={type}
            disabled={disabled}
            className={`btn btn-primary ${className}`.trim()}
            {...props}
        >
            {children}
        </button>
    );
};
export default PrimaryButton;
