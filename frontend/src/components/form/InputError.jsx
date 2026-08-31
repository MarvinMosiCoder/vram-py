// Breeze's InputError. Renders nothing without a message, so it can sit
// unconditionally under every field.
//
// The message comes from the backend: validate() in modules/base.py raises
// 422 with a { field: message } dict, which GeneratedModulePage stores and
// looks up by field name.
const InputError = ({ message, className = "" }) => {
    if (!message) return null;
    return <span className={`input-error ${className}`.trim()}>{message}</span>;
};
export default InputError;
