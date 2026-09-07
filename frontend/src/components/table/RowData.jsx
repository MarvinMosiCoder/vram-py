import React from "react";

const RowData = ({ children, sticky, center, isLoading }) => {
    const stickyClass = {
        left: `sticky left-0 top-0 z-40 after:absolute after:top-0 after:right-0 after:z-40 after:h-full after:w-px after:bg-skin-border bg-skin-panel text-skin-text`,
        right: `sticky right-0 top-0 z-40 before:absolute before:top-0 before:left-0 before:z-40 before:h-full before:w-px before:bg-skin-border bg-skin-panel text-skin-text`,
    }[sticky];

    return (
        <td
            className={`border-b border-skin-border px-3.5 py-2.5 text-skin-text text-[13px] align-middle ${stickyClass || ""} ${
                center ? "text-center" : "text-left"
            }`}
        >
            {isLoading ? (
                <span className={`animate-pulse inline-block w-3/4 rounded-md h-4 bg-skin-border`}>
                    &nbsp;&nbsp;
                </span>
            ) : (
                children
            )}
        </td>
    );
};

export default RowData;
