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
            className={`checkbox-input ${className}`.trim()}
            {...props}
        />
    );
};
export default Checkbox;
