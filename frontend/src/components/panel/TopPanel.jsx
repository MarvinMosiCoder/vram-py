// The page header strip: title on the left, tools on the right.
//
// The Laravel original got its title from the controller's page props; here
// it is passed in, because GeneratedModulePage already has the module name
// from render_index()'s `module` object.
const TopPanel = ({ title, children, className = "" }) => {
    return (
        <div className={`flex flex-wrap items-center justify-between gap-4 ${className}`.trim()}>
            {title && <h2 className="m-0 text-lg">{title}</h2>}
            {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
        </div>
    );
};
export default TopPanel;
