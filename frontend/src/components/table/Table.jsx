// <table>. The scroll frame lives in TableContainer, which this expects to be
// wrapped in -- see TableContainer.jsx.
//
// Mirrors the Laravel template's table component set: TableContainer / Table /
// TableHead / HeadData / TableBody / TableRow / RowData, plus RowActions +
// RowAction for the actions column. GeneratedModulePage composes these instead
// of writing raw <table> markup.
//
// Styling note: these use the project's semantic classes rather than Tailwind
// utilities. The .module-table rules in index.css are unlayered, so they beat
// any utility anyway -- see docs/ARCHITECTURE.md, "Styling and theming".
const Table = ({ children, className = "" }) => {
    return <table className={`module-table ${className}`.trim()}>{children}</table>;
};
export default Table;
