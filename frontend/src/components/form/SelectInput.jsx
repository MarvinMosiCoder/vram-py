// Not in Breeze, but the module forms need it: form_fields may declare
// `type: "select"` with an `options` array of {value, label} (or plain
// strings). Used by the theme_color field once personalThemeOptions is wired in.
const SelectInput = ({ value, onChange, options = [], disabled, placeholder, className = "", ...props }) => {
    return (
        <select
            value={value ?? ""}
            onChange={onChange}
            disabled={disabled}
            className={`select-input ${className}`.trim()}
            {...props}
        >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => {
                const item = typeof option === "string" ? { value: option, label: option } : option;
                return (
                    <option key={item.value} value={item.value}>
                        {item.label ?? item.value}
                    </option>
                );
            })}
        </select>
    );
};
export default SelectInput;
