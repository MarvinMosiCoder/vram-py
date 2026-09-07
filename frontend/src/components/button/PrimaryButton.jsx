// Shared primary action, styled with the active Tailwind theme tokens.
const PrimaryButton = ({ children, className = "", disabled, type = "submit", ...props }) => {
    return (
        <button
            type={type}
            disabled={disabled}
            className={`m-0 w-auto cursor-pointer rounded-md border px-3.5 py-1.75 text-[13px] font-medium disabled:cursor-default disabled:opacity-40 border-skin-accent bg-skin-custom text-theme-contrast enabled:hover:brightness-90 ${className}`.trim()}
            {...props}
        >
            {children}
        </button>
    );
};
export default PrimaryButton;
