export function detectLanguage(snippet: string): string {
    const trimmed = snippet.trim();

    if (/^\{[\s\S]*\}$/.test(trimmed) || /^\[[\s\S]*\]$/.test(trimmed)) {
        try {
            JSON.parse(trimmed);
            return 'json';
        } catch { }
    }

    const patterns: { [lang: string]: RegExp } = {
        typescript: /\b(interface|type|enum|namespace|as\s+\w+|:\s*\w+(\[\])?)\b/,
        javascript: /\b(const|let|var|function|=>|async|await|import|export|require)\b/,
        python: /\b(def|class|import|from|elif|lambda|yield|async def|__init__|self)\b/,
        java: /\b(public|private|protected|static|void|class|extends|implements|package)\b/,
        csharp: /\b(using|namespace|public|private|static|void|class|struct|interface|var)\b/,
        go: /\b(package|func|import|type|struct|interface|go|defer|chan)\b/,
        rust: /\b(fn|let|mut|impl|trait|struct|enum|pub|use|mod)\b/,
        sql: /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|GROUP BY|ORDER BY)\b/i,
        html: /<\/?[a-z][\s\S]*>/i,
        css: /[.#]?[\w-]+\s*\{[\s\S]*:[^:]+;[\s\S]*\}/,
        yaml: /^[\w-]+:\s*.+$/m,
        dockerfile: /^(FROM|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG)\b/m,
        bash: /^#!\/bin\/(bash|sh)|\b(echo|cd|ls|mkdir|rm|chmod|grep|awk|sed)\b/,
    };

    for (const lang in patterns) {
        if (patterns[lang].test(trimmed)) return lang;
    }

    return 'plaintext';
}

export function unwrapOuterCodeFence(text: string): string {
    if (!text || typeof text !== 'string') return '';

    const trimmed = text.trim();
    const match = trimmed.match(/^```[\w-]*\n([\s\S]*?)\n```$/);
    if (match && match[1] !== undefined) {
        return match[1];
    }

    return text;
}

export function formatLLMMessage(text: string): string {
    if (!text || typeof text !== 'string') return '';

    const fenceMatches = text.match(/```/g);
    if (fenceMatches && fenceMatches.length % 2 === 1) {
        text += '\n```';
    }

    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
}
