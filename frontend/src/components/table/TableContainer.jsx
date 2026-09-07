// The scroll/frame around a table.
//
// Split out of Table.jsx: a wide module table has to scroll sideways inside
// its own container, never taking the whole page with it, and the rounded
// border belongs to the frame rather than to <table>. Table is now just the
// <table> element.
const TableContainer = ({ children, className = "" }) => {
    return <div className={`overflow-x-auto rounded-[10px] border border-skin-border bg-skin-panel ${className}`.trim()}>{children}</div>;
};
export default TableContainer;
