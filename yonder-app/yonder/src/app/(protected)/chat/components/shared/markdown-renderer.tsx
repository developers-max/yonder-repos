import { memo, useMemo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import React from 'react';

interface MarkdownRendererProps {
    children: string;
    className?: string;
}

// Memoized markdown component with custom styling components
const MarkdownRenderer = memo(({ children, className }: MarkdownRendererProps) => {

    const components: Components = useMemo(() => ({
        // Headings
        h1: ({ children, ...props }) => {
            return <h1 className="text-xl font-semibold text-foreground mb-1 mt-2" {...props}>{children}</h1>;
        },
        h2: ({ children, ...props }) => {
            return <h2 className="text-lg font-semibold text-foreground mb-1 mt-2" {...props}>{children}</h2>;
        },
        h3: ({ children, ...props }) => {
            return <h3 className="text-base font-semibold text-foreground mb-0.5 mt-1.5" {...props}>{children}</h3>;
        },
        h4: ({ children, ...props }) => {
            return <h4 className="text-sm font-semibold text-foreground mb-0.5 mt-1.5" {...props}>{children}</h4>;
        },
        h5: ({ children, ...props }) => {
            return <h5 className="text-sm font-medium text-foreground mb-0.5 mt-1.5" {...props}>{children}</h5>;
        },
        h6: ({ children, ...props }) => {
            return <h6 className="text-xs font-medium text-foreground mb-0.5 mt-1.5" {...props}>{children}</h6>;
        },

        // Paragraphs
        p: ({ children, ...props }) => {
            return <p className="text-foreground leading-relaxed mb-1" {...props}>{children}</p>;
        },

        // Lists
        ul: ({ children, ...props }) => {
            return <ul className="list-disc pl-6 mb-4 space-y-2" {...props}>{children}</ul>;
        },
        ol: ({ children, ...props }) => {
            return <ol className="list-decimal pl-6 mb-1 space-y-2" {...props}>{children}</ol>;
        },
        li: ({ children, ...props }) => {
            return <li className="text-foreground" {...props}>{children}</li>;
        },

        // Text formatting
        strong: ({ children, ...props }) => {
            return <strong className="font-semibold text-foreground" {...props}>{children}</strong>;
        },
        em: ({ children, ...props }) => {
            return <em className="italic text-foreground" {...props}>{children}</em>;
        },

        // Code
        code: ({ children, ...props }) => {
            return <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>;
        },
        pre: ({ children, ...props }) => {
            return <pre className="bg-muted border rounded-lg p-4 overflow-x-auto mb-1" {...props}>{children}</pre>;
        },

        // Blockquotes
        blockquote: ({ children, ...props }) => {
            return <blockquote className="border-l-4 border-muted-foreground pl-4 italic text-muted-foreground mb-1" {...props}>{children}</blockquote>;
        },

        // Links
        a: ({ children, ...props }) => {
            return (
                <a
                    {...props}
                    className="text-primary underline hover:text-primary/80 transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {children}
                </a>
            );
        },

        // Horizontal rule
        hr: ({ ...props }) => {
            return <hr className="border-border my-2" {...props} />;
        },
    }), []);

    return (
        <div className={className}>
            <ReactMarkdown
                components={components}
            >
                {children}
            </ReactMarkdown>
        </div>
    );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';

export default MarkdownRenderer; 