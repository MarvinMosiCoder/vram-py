// The card that wraps a block of page content -- used by the module pages for
// the view/create/edit record form.
//
// `as="form"` lets it BE the form element rather than contain one, so the
// submit button in `footer` works without a form id / portal.
const ContentPanel = ({ title, children, footer, onClose, as: Tag = "div", className = "", ...props }) => {
    return (
        <Tag className={`flex flex-col gap-4 rounded-[10px] border border-skin-border bg-skin-panel p-5 ${className}`.trim()} {...props}>
            {(title || onClose) && (
                <div className="flex items-center justify-between gap-4">
                    {title && <h3 className="m-0 text-[15px]">{title}</h3>}
                    {onClose && (
                        <button type="button" className="m-0 w-auto cursor-pointer rounded-md border px-3.5 py-1.75 text-[13px] font-medium disabled:cursor-default disabled:opacity-40 border-skin-border bg-transparent text-skin-dim enabled:hover:bg-skin-border enabled:hover:text-skin-text" onClick={onClose}>
                            Close
                        </button>
                    )}
                </div>
            )}
            <div className="">{children}</div>
            {footer && <div className="flex justify-end">{footer}</div>}
        </Tag>
    );
};
export default ContentPanel;
