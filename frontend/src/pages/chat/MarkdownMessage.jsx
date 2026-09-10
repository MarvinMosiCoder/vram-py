import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Assistant replies arrive as markdown. Every element is mapped explicitly so
// the output uses theme tokens instead of browser defaults -- there is no
// typography plugin in this project (Tailwind v4, configured in index.css).
const components = {
    p: ({ children }) => <p className="m-0 mb-3 leading-6 last:mb-0">{children}</p>,

    h1: ({ children }) => <h3 className="m-0 mb-2 mt-4 text-base font-semibold text-skin-text first:mt-0">{children}</h3>,
    h2: ({ children }) => <h4 className="m-0 mb-2 mt-4 text-sm font-semibold text-skin-text first:mt-0">{children}</h4>,
    h3: ({ children }) => <h5 className="m-0 mb-1.5 mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-skin-accent first:mt-0">{children}</h5>,
    h4: ({ children }) => <h6 className="m-0 mb-1.5 mt-3 text-xs font-semibold text-skin-text first:mt-0">{children}</h6>,

    ul: ({ children }) => <ul className="m-0 mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
    ol: ({ children }) => <ol className="m-0 mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
    li: ({ children }) => <li className="leading-6 marker:text-skin-dim">{children}</li>,

    strong: ({ children }) => <strong className="font-semibold text-skin-text">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    hr: () => <hr className="my-4 border-0 border-t border-skin-border" />,

    a: ({ children, href }) => (
        <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-skin-accent underline underline-offset-2 hover:opacity-80"
        >
            {children}
        </a>
    ),

    blockquote: ({ children }) => (
        <blockquote className="m-0 mb-3 border-l-2 border-skin-accent pl-3 text-skin-dim last:mb-0">
            {children}
        </blockquote>
    ),

    // react-markdown dropped the `inline` prop in v9, so code is always styled
    // as inline and `pre` resets those styles for the block it wraps.
    code: ({ children }) => (
        <code className="rounded bg-skin-panel px-1.5 py-0.5 font-mono text-[0.85em] text-skin-accent">
            {children}
        </code>
    ),

    pre: ({ children }) => (
        <pre className="m-0 mb-3 overflow-x-auto rounded-xl border border-skin-border bg-skin-panel p-3 last:mb-0 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-skin-text">
            {children}
        </pre>
    ),

    // Wide tables scroll inside the bubble rather than stretching it.
    table: ({ children }) => (
        <div className="mb-3 overflow-x-auto last:mb-0">
            <table className="w-full border-collapse text-left text-xs">{children}</table>
        </div>
    ),
    th: ({ children }) => (
        <th className="border border-skin-border px-2 py-1.5 font-semibold text-skin-text">{children}</th>
    ),
    td: ({ children }) => (
        <td className="border border-skin-border px-2 py-1.5 align-top">{children}</td>
    ),
};

const MarkdownMessage = ({ content }) => (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
    </ReactMarkdown>
);

export default MarkdownMessage;
