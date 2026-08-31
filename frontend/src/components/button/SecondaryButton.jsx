// Breeze's SecondaryButton -- the outlined variant. Replaces the `.signout`
// class the module pages were borrowing for every toolbar button.
const SecondaryButton = ({ children, className = "", disabled, type = "button", ...props }) => {
    return (
        <button
            type={type}
            disabled={disabled}
            className={`btn btn-secondary ${className}`.trim()}
            {...props}
        >
            {children}
        </button>
    );
};
export default SecondaryButton;
