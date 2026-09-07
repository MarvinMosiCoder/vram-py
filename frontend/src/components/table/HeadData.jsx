// <th>. The header counterpart of RowData, with the same sticky/center props
// so a header cell and its column line up.
//
// `sortable` + `sorted` + `direction` render the sort affordance. Whether a
// click actually sorts is decided by the BACKEND: order_by() in
// modules/base.py only honours columns the module declared, and silently
// ignores anything else.
const HeadData = ({ children, sortable, sorted, direction, onSort, sticky, center, width }) => {
    const classes = [
        "border-b border-skin-border px-3.5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-skin-dim select-none",
        sticky ? `sticky top-0 z-40 bg-skin-panel ${sticky === "left" ? "left-0" : "right-0"}` : "",
        center ? "text-center" : "text-left",
        sortable ? "cursor-pointer hover:text-skin-text" : "cursor-default",
    ].filter(Boolean).join(" ");

    return (
        <th
            className={classes || undefined}
            style={width ? { width } : undefined}
            onClick={sortable ? onSort : undefined}
            aria-sort={sorted ? (direction === "asc" ? "ascending" : "descending") : undefined}
            scope="col"
        >
            {children}
            {sorted && <span className="text-skin-accent">{direction === "asc" ? " ▲" : " ▼"}</span>}
        </th>
    );
};
export default HeadData;
