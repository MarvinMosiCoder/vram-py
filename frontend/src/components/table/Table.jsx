// <table>. The scroll frame lives in TableContainer, which this expects to be
// wrapped in -- see TableContainer.jsx.
//
// Mirrors the Laravel template's table component set: TableContainer / Table /
// TableHead / HeadData / TableBody / TableRow / RowData, plus RowActions +
// RowAction for the actions column. GeneratedModulePage composes these instead
// of writing raw <table> markup.
//
const Table = ({ children, className = "" }) => {
    return <table className={`w-full border-collapse bg-skin-panel [&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover]:bg-skin-accent-soft ${className}`.trim()}>{children}</table>;
};
export default Table;
