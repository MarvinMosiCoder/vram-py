import type { ReactNode } from "react";

type InputLabelProps = {
    value?: string;
    children?: ReactNode;
    htmlFor?: string;
    required?: boolean;
    className?: string;
};

const InputLabel = ({ value, children, htmlFor, required, className = "" }: InputLabelProps) => {
    return (
        <span className={`text-xs text-skin-dim ${className}`.trim()} id={htmlFor ? `${htmlFor}-label` : undefined}>
            {value ?? children}
            {required && <em className="text-skin-danger not-italic"> *</em>}
        </span>
    );
};
export default InputLabel;
