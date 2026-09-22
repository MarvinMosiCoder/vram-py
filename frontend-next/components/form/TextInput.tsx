import type { ComponentPropsWithoutRef } from "react";

type TextInputProps = ComponentPropsWithoutRef<"input">;

const TextInput = ({ type = "text", value, onChange, readOnly, maxLength, className = "", ...props }: TextInputProps) => {
    return (
        <input
            type={type}
            value={value ?? ""}
            onChange={onChange}
            readOnly={readOnly}
            maxLength={maxLength}
            className={`w-full rounded-md border border-skin-border bg-skin-bg px-3 py-2.5 font-body text-sm text-skin-text focus:outline-2 focus:outline-offset-1 focus:outline-skin-accent ${className}`.trim()}
            {...props}
        />
    );
};
export default TextInput;
