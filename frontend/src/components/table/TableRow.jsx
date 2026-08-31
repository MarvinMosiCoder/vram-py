// <tr>. `selected` and `onClick` are here for row selection, which no module
// uses yet -- the props exist so adding it later needs no change here.
const TableRow = ({ children, onClick, selected }) => {
    return (
        <tr
            className={selected ? "is-selected" : undefined}
            onClick={onClick}
            style={onClick ? { cursor: "pointer" } : undefined}
        >
            {children}
        </tr>
    );
};
export default TableRow;
