// <th>. The header counterpart of RowData, with the same sticky/center props
// so a header cell and its column line up.
//
// `sortable` + `sorted` + `direction` render the sort affordance. Whether a
// click actually sorts is decided by the BACKEND: order_by() in
// modules/base.py only honours columns the module declared, and silently
// ignores anything else.
const HeadData = ({ children, sortable, sorted, direction, onSort, sticky, center, width }) => {
    const classes = [
        sticky ? `is-sticky-${sticky}` : "",
        center ? "is-center" : "",
        sortable ? "is-sortable" : "is-plain",
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
            {sorted && <span className="sort-caret">{direction === "asc" ? " ▲" : " ▼"}</span>}
        </th>
    );
};
export default HeadData;
