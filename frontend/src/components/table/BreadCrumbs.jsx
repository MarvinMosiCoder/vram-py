import { Link, useLocation } from "react-router-dom";

const prettify = (segment) =>
    segment
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

const BreadCrumbs = ({ title, items, className = "" }) => {
    const { pathname } = useLocation();

    const [root] = pathname.split("/").filter(Boolean);
    const derived = root ? [{ label: prettify(root), to: "/" + root }] : [];

    const trail = items ?? [{ label: "Dashboard", to: "/dashboard" }, ...derived];
   
    const crumbs = trail.filter(
        (crumb, i) => !(i > 0 && crumb.to === trail[0].to)
    );

    return (
        <nav className={`text-xs text-skin-dim [&_ol]:m-0 [&_ol]:flex [&_ol]:list-none [&_ol]:flex-wrap [&_ol]:items-center [&_ol]:gap-1.5 [&_ol]:p-0 [&_li]:flex [&_li]:items-center [&_li]:gap-1.5 [&_a]:text-skin-dim [&_a]:no-underline [&_a:hover]:text-skin-accent [&_[aria-current=page]_span]:font-medium [&_[aria-current=page]_span]:text-skin-text ${className}`.trim()} aria-label="Breadcrumb">
            <ol>
                {crumbs.map((crumb, i) => {
                    const isLast = i === crumbs.length - 1;
                    return (
                        <li key={crumb.to} aria-current={isLast ? "page" : undefined}>
                            {isLast ? (
                                <span>{title ?? crumb.label}</span>
                            ) : (
                                <Link to={crumb.to}>{crumb.label}</Link>
                            )}
                            {!isLast && <span className="text-skin-border" aria-hidden="true">/</span>}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default BreadCrumbs;
