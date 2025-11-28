

interface AnsiStyle {
    color?: string;
    backgroundColor?: string;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
}

const ANSI_COLORS: Record<number, string> = {
    30: '#000000', 
    31: '#CD3131', 
    32: '#0DBC79', 
    33: '#E5E510', 
    34: '#2472C8', 
    35: '#BC3FBC', 
    36: '#11A8CD', 
    37: '#E5E5E5', 

    90: '#666666', 
    91: '#F14C4C', 
    92: '#23D18B', 
    93: '#F5F543', 
    94: '#3B8EEA', 
    95: '#D670D6', 
    96: '#29B8DB', 
    97: '#FFFFFF', 
};

export function ansiToHtml(text: string): React.ReactNode[] {
    const elements: React.ReactNode[] = [];
    let currentStyle: AnsiStyle = {};
    let keyCounter = 0;

    const ansiRegex = /\x1B\[([0-9;]*)m/g;
    let match;
    let lastIndex = 0;

    while ((match = ansiRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const textContent = text.substring(lastIndex, match.index);
            if (textContent) {
                if (Object.keys(currentStyle).length > 0) {
                    elements.push(
                        <span key={`ansi-${keyCounter++}`} style={currentStyle}>
                            {textContent}
                        </span>
                    );
                } else {
                    elements.push(textContent);
                }
            }
        }

        const codes = match[1].split(';').map(Number);
        currentStyle = applyAnsiCodes(currentStyle, codes);

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        const textContent = text.substring(lastIndex);
        if (textContent) {
            if (Object.keys(currentStyle).length > 0) {
                elements.push(
                    <span key={`ansi-${keyCounter++}`} style={currentStyle}>
                        {textContent}
                    </span>
                );
            } else {
                elements.push(textContent);
            }
        }
    }

    return elements.length > 0 ? elements : [text];
}

function applyAnsiCodes(currentStyle: AnsiStyle, codes: number[]): AnsiStyle {
    const newStyle = { ...currentStyle };

    for (const code of codes) {
        if (code === 0) {
            return {};
        } else if (code === 1) {
            newStyle.fontWeight = 'bold';
        } else if (code === 2) {
            newStyle.fontWeight = '300';
        } else if (code === 3) {
            newStyle.fontStyle = 'italic';
        } else if (code === 4) {
            newStyle.textDecoration = 'underline';
        } else if (code === 7) {
            const tempColor = newStyle.color;
            newStyle.color = newStyle.backgroundColor;
            newStyle.backgroundColor = tempColor;
        } else if (code === 22) {
            delete newStyle.fontWeight;
        } else if (code === 23) {
            delete newStyle.fontStyle;
        } else if (code === 24) {
            delete newStyle.textDecoration;
        } else if (code >= 30 && code <= 37) {
            newStyle.color = ANSI_COLORS[code];
        } else if (code >= 40 && code <= 47) {
            newStyle.backgroundColor = ANSI_COLORS[code - 10];
        } else if (code >= 90 && code <= 97) {
            newStyle.color = ANSI_COLORS[code];
        } else if (code >= 100 && code <= 107) {
            newStyle.backgroundColor = ANSI_COLORS[code - 10];
        } else if (code === 39) {
            delete newStyle.color;
        } else if (code === 49) {
            delete newStyle.backgroundColor;
        }
    }

    return newStyle;
}

export function stripAnsi(text: string): string {
    return text.replace(/\x1B\[[0-9;]*m/g, '');
}

export function hasAnsiCodes(text: string): boolean {
    return /\x1B\[[0-9;]*m/.test(text);
}

export function ansiToHtmlString(text: string): string {
    const elements = ansiToHtml(text);

    return elements
        .map((el) => {
            if (typeof el === 'string') {
                return el;
            }
            return text;
        })
        .join('');
}
