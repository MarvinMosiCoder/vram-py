// Breeze's DangerButton, for destructive confirmations.
const DangerButton = ({ children, className = "", disabled, type = "button", ...props }) => {
    return (
        <button
            type={type}
            disabled={disabled}
            className={`m-0 w-auto cursor-pointer rounded-md border px-3.5 py-1.75 text-[13px] font-medium disabled:cursor-default disabled:opacity-40 border-skin-danger/45 bg-transparent text-skin-danger enabled:hover:bg-skin-danger-soft ${className}`.trim()}
            {...props}
        >
            {children}
        </button>
    );
};
export default DangerButton;
