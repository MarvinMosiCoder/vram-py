// Breeze's InputLabel. `required` renders the asterisk from the module's own
// form_fields metadata, so the label and the backend's validate() agree about
// which fields are mandatory.
const InputLabel = ({ value, children, htmlFor, required, className = "" }) => {
    return (
        <span className={`text-xs text-skin-dim ${className}`.trim()} id={htmlFor ? `${htmlFor}-label` : undefined}>
            {value ?? children}
            {required && <em className="text-skin-danger not-italic"> *</em>}
        </span>
    );
};
export default InputLabel;
