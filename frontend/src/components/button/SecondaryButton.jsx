// Breeze's SecondaryButton -- the outlined variant. Replaces the `.signout`
// class the module pages were borrowing for every toolbar button.
const SecondaryButton = ({ children, className = "", disabled, type = "button", ...props }) => {
    return (
        <button
            type={type}
            disabled={disabled}
            className={`m-0 w-auto cursor-pointer rounded-md border px-3.5 py-1.75 text-[13px] font-medium disabled:cursor-default disabled:opacity-40 border-skin-border bg-transparent text-skin-dim enabled:hover:bg-skin-border enabled:hover:text-skin-text ${className}`.trim()}
            {...props}
        >
            {children}
        </button>
    );
};
export default SecondaryButton;
