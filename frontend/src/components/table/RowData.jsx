import React from "react";
import { useTheme } from "../../context/ThemeContext";

const RowData = ({ children, sticky, center, isLoading }) => {
    const { theme } = useTheme();
    const isDark = theme === "bg-skin-black";
    const stickyClass = {
        left: `sticky left-0 top-0 z-40 after:absolute after:top-0 after:right-0 after:z-40 after:h-full after:w-px ${isDark ? "after:bg-gray-800 bg-black-table-color text-gray-300" : "after:bg-gray-200 bg-white"}`,
        right: `sticky right-0 top-0 z-40 before:absolute before:top-0 before:left-0 before:z-40 before:h-full before:w-px ${isDark ? "before:bg-gray-800 bg-black-table-color text-gray-300" : "before:bg-gray-200 bg-white"}`,
    }[sticky];

    return (
        <td
            className={`px-4 py-3 ${isDark ? "text-gray-300" : "text-gray-700"} text-[12px] align-middle ${stickyClass || ""} ${
                center && "is-center text-center"
            }`}
        >
            {isLoading ? (
                <span className={`animate-pulse inline-block w-3/4 rounded-md h-4 p-auto ${isDark ? "bg-gray-800" : "bg-gray-200"}`}>
                    &nbsp;&nbsp;
                </span>
            ) : (
                children
            )}
        </td>
    );
};

export default RowData;
