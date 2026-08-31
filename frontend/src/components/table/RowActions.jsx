// The per-row action cluster for a module table.
//
// Ported from the Laravel template, where the original used Tailwind
// utilities ("flex items-center justify-center gap-2"). Tailwind is now
// installed here too, so those would work -- but .row-actions in index.css
// also styles the buttons inside the cluster, which bare layout utilities
// did not. See docs/ARCHITECTURE.md, "Styling".
//
// NOTE: nothing renders this yet. GeneratedModulePage accepts `actions` and
// `customRowActions` props but has no actions column, so this component is
// scaffolding waiting for that column.
const RowActions = ({ children }) => {
    return <div className="row-actions">{children}</div>;
};
export default RowActions;
