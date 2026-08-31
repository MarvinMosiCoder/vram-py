// The card that wraps a block of page content -- used by the module pages for
// the view/create/edit record form.
//
// `as="form"` lets it BE the form element rather than contain one, so the
// submit button in `footer` works without a form id / portal.
const ContentPanel = ({ title, children, footer, onClose, as: Tag = "div", className = "", ...props }) => {
    return (
        <Tag className={`content-panel ${className}`.trim()} {...props}>
            {(title || onClose) && (
                <div className="content-panel-head">
                    {title && <h3 className="content-panel-title">{title}</h3>}
                    {onClose && (
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Close
                        </button>
                    )}
                </div>
            )}
            <div className="content-panel-body">{children}</div>
            {footer && <div className="content-panel-foot">{footer}</div>}
        </Tag>
    );
};
export default ContentPanel;
