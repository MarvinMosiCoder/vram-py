// Breeze's TextInput. `maxLength` is fed from form_fields' `max`, which is the
// same number validate() enforces server-side -- so the field stops you before
// the round trip, and the backend still has the last word.
const TextInput = ({ type = "text", value, onChange, readOnly, maxLength, className = "", ...props }) => {
    return (
        <input
            type={type}
            value={value ?? ""}
            onChange={onChange}
            readOnly={readOnly}
            maxLength={maxLength || undefined}
            className={`w-full rounded-md border border-skin-border bg-skin-bg px-3 py-2.5 font-body text-sm text-skin-text focus:outline-2 focus:outline-offset-1 focus:outline-skin-accent ${className}`.trim()}
            {...props}
        />
    );
};
export default TextInput;
