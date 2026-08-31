// The page header strip: title on the left, tools on the right.
//
// The Laravel original got its title from the controller's page props; here
// it is passed in, because GeneratedModulePage already has the module name
// from render_index()'s `module` object.
const TopPanel = ({ title, children, className = "" }) => {
    return (
        <div className={`top-panel ${className}`.trim()}>
            {title && <h2 className="top-panel-title">{title}</h2>}
            {children && <div className="top-panel-tools">{children}</div>}
        </div>
    );
};
export default TopPanel;
