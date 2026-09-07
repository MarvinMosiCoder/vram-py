// Breeze's Checkbox.
//
// Emits 1/0 rather than true/false on purpose: every checkbox field in this
// project maps to an INTEGER column (adm_roles.is_superadmin), and Postgres
// rejects a boolean written into an integer column.
const Checkbox = ({ checked, onChange, disabled, className = "", ...props }) => {
    return (
        <input
            type="checkbox"
            checked={Boolean(checked)}
            disabled={disabled}
            onChange={(e) => onChange?.(e.target.checked ? 1 : 0, e)}
            className={`size-4 shrink-0 self-start accent-skin-accent focus:outline-2 focus:outline-offset-1 focus:outline-skin-accent ${className}`.trim()}
            {...props}
        />
    );
};
export default Checkbox;
