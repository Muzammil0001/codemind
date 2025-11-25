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

    a: ({ href, children }: any) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
        >
            {children}
        </a>
    ),

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
