"use client";

import type { ReactNode } from "react";
// The per-row action cluster for a module table.
const RowActions = ({ children }: { children: ReactNode }) => {
    return <div className="flex items-center justify-center gap-2">{children}</div>;
};
export default RowActions;
