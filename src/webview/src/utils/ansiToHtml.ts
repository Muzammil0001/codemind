

const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

const ANSI_COLORS: Record<string, string> = {
    '0': 'reset',

    '30': '#000000', 
    '31': '#ef4444', 
    '32': '#22c55e', 
    '33': '#eab308', 
    '34': '#3b82f6', 
    '35': '#a855f7', 
    '36': '#06b6d4', 
    '37': '#d1d5db', 

    '90': '#6b7280', 
    '91': '#f87171', 
    '92': '#4ade80', 
    '93': '#fbbf24', 
    '94': '#60a5fa', 
    '95': '#c084fc', 
    '96': '#22d3ee', 
    '97': '#f3f4f6', 
};

export function stripAnsi(text: string): string {
    return text.replace(ANSI_REGEX, '');
}

export function ansiToHtml(text: string): string {
    let result = '';
    let lastIndex = 0;
    let currentColor = '';
    let isBold = false;

    const matches = text.matchAll(/\x1b\[([0-9;]*)m/g);

    for (const match of matches) {
        const textBefore = text.slice(lastIndex, match.index);
        if (textBefore) {
            result += formatText(textBefore, currentColor, isBold);
        }

        const codes = match[1].split(';').filter(c => c);

        for (const code of codes) {
            if (code === '0') {
                currentColor = '';
                isBold = false;
            } else if (code === '1') {
                isBold = true;
            } else if (ANSI_COLORS[code]) {
                currentColor = ANSI_COLORS[code];
            }
        }

        lastIndex = (match.index || 0) + match[0].length;
    }

    const remainingText = text.slice(lastIndex);
    if (remainingText) {
        result += formatText(remainingText, currentColor, isBold);
    }

    return result || text;
}

function formatText(text: string, color: string, bold: boolean): string {
    if (!color && !bold) {
        return escapeHtml(text);
    }

    const styles: string[] = [];

    if (color && color !== 'reset') {
        styles.push(`color: ${color}`);
    }

    if (bold) {
        styles.push('font-weight: 600');
    }

    const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
    return `<span${styleAttr}>${escapeHtml(text)}</span>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function hasAnsiCodes(text: string): boolean {
    return ANSI_REGEX.test(text);
}
