"use client";

import type { ReactNode } from "react";
// <thead>. Exists so a page never has to remember that the header row and
// the body rows must carry the same number of cells.
const TableHead = ({ children }: { children: ReactNode }) => {
    return <thead>{children}</thead>;
};
export default TableHead;
