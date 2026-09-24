"use client";

import { useId, type SelectHTMLAttributes } from "react";
import Select, { type ClassNamesConfig, type SingleValue } from "react-select";
import type { SelectOption } from "@/types/modules";

type NativeProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "type"> & {
  type?: ""; options?: SelectOption[]; placeholder?: string;
};
type SearchableProps = {
  type: "react-select"; value: SelectOption | null; options: SelectOption[];
  onChange: (option: SingleValue<SelectOption>) => void; disabled?: boolean;
  placeholder?: string; className?: string; inputId?: string; "aria-label"?: string;
};

export default function SelectInput(props: NativeProps | SearchableProps) {
  const instanceId = useId();
    const selectClasses: ClassNamesConfig<SelectOption, false> = {
        control: ({ isFocused, isDisabled }) => `flex min-h-10 rounded-md border bg-skin-bg text-sm text-skin-text ${isFocused ? "border-skin-accent ring-1 ring-skin-accent" : "border-skin-border hover:border-skin-accent"} ${isDisabled ? "opacity-50" : ""}`,
        valueContainer: () => "flex flex-wrap gap-1 px-3 py-2",
        input: () => "text-skin-text",
        placeholder: () => "text-skin-dim",
        singleValue: () => "text-skin-text",
        indicatorsContainer: () => "text-skin-dim",
        dropdownIndicator: () => "p-2 hover:text-skin-text",
        clearIndicator: () => "cursor-pointer p-2 hover:text-skin-text",
        indicatorSeparator: () => "my-2 w-px bg-skin-border",
        menu: () => "z-50! mt-1 overflow-hidden rounded-md border border-skin-border bg-skin-panel text-sm text-skin-text shadow-lg",
        menuList: () => "py-1",
        option: ({ isSelected, isFocused, isDisabled }) => `px-3 py-2 ${isSelected ? "bg-skin-custom text-theme-contrast" : isFocused ? "bg-skin-accent-soft text-skin-text" : "text-skin-text"} ${isDisabled ? "opacity-40" : "cursor-pointer"}`,
        multiValue: () => "flex overflow-hidden rounded bg-skin-accent-soft",
        multiValueLabel: () => "px-2 py-0.5 text-skin-text",
        multiValueRemove: () => "cursor-pointer px-1 text-skin-text hover:bg-skin-border",
        noOptionsMessage: () => "p-3 text-skin-dim",
        loadingMessage: () => "p-3 text-skin-dim",
    };

  if (props.type === "react-select") {
    return <Select<SelectOption, false>
      instanceId={instanceId} inputId={props.inputId} aria-label={props["aria-label"]}
      value={props.value} onChange={props.onChange} options={props.options}
      isDisabled={props.disabled} placeholder={props.placeholder}
      className={`block w-full rounded-md sm:text-sm ${props.className ?? ""}`.trim()}
      unstyled classNames={selectClasses}
    />;
  }
  const { options = [], placeholder, className = "", ...nativeProps } = props;
  return <select {...nativeProps} className={`w-full rounded-md border border-skin-border bg-skin-bg px-3 py-2.5 font-body text-sm text-skin-text focus:outline-2 focus:outline-offset-1 focus:outline-skin-accent ${className}`.trim()}>
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
}
