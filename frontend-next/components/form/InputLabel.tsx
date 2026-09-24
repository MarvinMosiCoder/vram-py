import type { ReactNode } from "react";

type InputLabelProps = {
    value?: string;
    children?: ReactNode;
    htmlFor?: string;
    required?: boolean;
    className?: string;
};

const InputLabel = ({ value, children, htmlFor, required, className = "" }: InputLabelProps) => {
    const Tag = htmlFor ? "label" : "span";
    return (
        <Tag htmlFor={htmlFor} className={`text-xs text-skin-dim ${className}`.trim()} id={htmlFor ? `${htmlFor}-label` : undefined}>
            {value ?? children}
            {required && <em aria-hidden="true" className="text-skin-danger not-italic"> *</em>}
        </Tag>
    );
};
export default InputLabel;
