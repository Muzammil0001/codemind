import { CodeBlock } from './CodeBlock';

export const markdownComponents = {
    pre({ children }: any) {
        let code = '';
        let language = 'code';

        if (Array.isArray(children)) {
            const child = children[0];
            if (child?.props?.className?.startsWith('language-')) {
                language = child.props.className.replace('language-', '');
                code = String(child.props.children).replace(/\n$/, '');
            }
        } else if (children?.props?.className?.startsWith('language-')) {
            language = children.props.className.replace('language-', '');
            code = String(children.props.children).replace(/\n$/, '');
        }

        if (code) {
            return <CodeBlock code={code} language={language} />;
        }

        return (
            <pre className="bg-zinc-900 p-3 rounded-lg overflow-x-auto text-sm">
                {children}
            </pre>
        );
    },

    code({ className, children }: any) {
        if (className && className.startsWith('language-')) {
            return <code>{children}</code>;
        }

        return (
            <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-blue-400 text-sm font-mono">
                {children}
            </code>
        );
    },

    h1: ({ children }: any) => (
        <h1 className="text-2xl font-bold text-zinc-100 mt-6 mb-4">{children}</h1>
    ),
    h2: ({ children }: any) => (
        <h2 className="text-xl font-bold text-zinc-100 mt-5 mb-3">{children}</h2>
    ),
    h3: ({ children }: any) => (
        <h3 className="text-lg font-semibold text-zinc-200 mt-4 mb-2">{children}</h3>
    ),

    p: ({ children }: any) => (
        <p className="text-zinc-100 leading-relaxed mb-4 last:mb-0 break-words">
            {children}
        </p>
    ),

    ul: ({ children }: any) => (
        <ul className="list-disc list-inside space-y-1 text-zinc-100 mb-4">
            {children}
        </ul>
    ),
    ol: ({ children }: any) => (
        <ol className="list-decimal list-inside space-y-1 text-zinc-100 mb-4">
            {children}
        </ol>
    ),

    li: ({ children }: any) => (
        <li className="text-zinc-100 leading-relaxed">{children}</li>
    ),

    strong: ({ children }: any) => (
        <strong className="font-bold text-white">{children}</strong>
    ),
    em: ({ children }: any) => (
        <em className="italic text-zinc-200">{children}</em>
    ),

    a: ({ href, children }: any) => {
        // Check if this is a file path (doesn't start with http:// or https://)
        const isFilePath = href && !href.startsWith('http://') && !href.startsWith('https://');

        if (isFilePath) {
            return (
                <button
                    onClick={() => {
                        // Post message to VS Code to open the file
                        if (window.vscode) {
                            window.vscode.postMessage({
                                type: 'openFile',
                                path: href
                            });
                        }
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 hover:text-blue-200 border border-blue-500/30 hover:border-blue-400/50 cursor-pointer transition-all duration-200 font-medium text-sm"
                    title={`Click to open: ${href}`}
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {children}
                </button>
            );
        }

        return (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
            >
                {children}
            </a>
        );
    },

    blockquote: ({ children }: any) => (
        <blockquote className="border-l-4 border-blue-500 pl-4 italic text-zinc-300 my-4">
            {children}
        </blockquote>
    ),

    table: ({ children }: any) => (
        <div className="overflow-x-auto my-4">
            <table className="min-w-full border border-zinc-700 rounded-lg overflow-hidden">
                {children}
            </table>
        </div>
    ),
    thead: ({ children }: any) => (
        <thead className="bg-zinc-800">{children}</thead>
    ),
    tbody: ({ children }: any) => (
        <tbody className="divide-y divide-zinc-700">{children}</tbody>
    ),
    tr: ({ children }: any) => (
        <tr className="hover:bg-zinc-800/50">{children}</tr>
    ),
    th: ({ children }: any) => (
        <th className="px-4 py-2 text-left text-sm font-semibold text-zinc-200">
            {children}
        </th>
    ),
    td: ({ children }: any) => (
        <td className="px-4 py-2 text-sm text-zinc-300">{children}</td>
    ),

    hr: () => <hr className="border-zinc-700 my-6" />,
};
