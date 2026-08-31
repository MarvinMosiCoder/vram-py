import { Link, useLocation } from "react-router-dom";

// The breadcrumb trail above a page's content.
//
// The Laravel original took `data={auth}` and read the module list out of
// Inertia's shared props. There are no shared props here, so the trail is
// derived from the URL instead -- which works for every module without the
// backend having to send anything extra.
//
// Pass `items` to override: [{ label, to }], last one rendered as current.

const prettify = (segment) =>
    segment
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

const BreadCrumbs = ({ title, items, className = "" }) => {
    const { pathname } = useLocation();

    const segments = pathname.split("/").filter(Boolean);
    const derived = segments.map((segment, i) => ({
        label: prettify(segment),
        to: "/" + segments.slice(0, i + 1).join("/"),
    }));

    // Dashboard is the implicit root -- it is the one page every signed-in user
    // can always reach, and it has no row in any menu table.
    const trail = items ?? [{ label: "Dashboard", to: "/dashboard" }, ...derived];

    // Drop a duplicate leading crumb when you are already on /dashboard.
    const crumbs = trail.filter(
        (crumb, i) => !(i > 0 && crumb.to === trail[0].to)
    );

    return (
        <nav className={`breadcrumbs ${className}`.trim()} aria-label="Breadcrumb">
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
                            {!isLast && <span className="breadcrumbs-sep" aria-hidden="true">/</span>}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default BreadCrumbs;
