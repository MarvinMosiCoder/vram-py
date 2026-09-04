
import Select from "react-select";
const SelectInput = ({ value, onChange, options = [], disabled, placeholder, type= '', className = "", ...props }) => {
    const customStyles = {
        control: (provided) => ({
            ...provided,
            backgroundColor: "#101215", // Dark background (Tailwind's bg-gray-800)
            borderColor: "#9CA3AF)", // Border color (Tailwind's border-gray-600)
            color: "#fff", // Text color
            boxShadow: "none",
            "&:hover": {
                borderColor: "#9ca3af", // Hover state border color (Tailwind's border-gray-400)
            },
        }),
        singleValue: (provided) => ({
            ...provided,
            color: "#9CA3AF", // Ensure selected value text is white
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: "#1f2937", // Dark background for dropdown menu
            color: "#9CA3AF", // Dropdown text color
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isFocused ? "#374151" : "#1f2937", // Highlight on hover (Tailwind's bg-gray-700)
            color: "#9CA3AF", // Option text color
            "&:active": {
                backgroundColor: "#4b5563", // Active state background
            },
        }),
    };


    if (type) {
        return (
            <Select
                value={value}
                onChange={onChange}
                options={options}
                isDisabled={disabled}
                placeholder={placeholder}
                className={`block w-full bg-gray-800 border-gray-300  rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${className}`.trim()}
                styles={customStyles}
                {...props}
            />
        );
    }
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
