

export interface CommandIntent {
    
    type: 'build' | 'test' | 'dev' | 'install' | 'remove' | 'cat' | 'ls' | 'git' | 'script' | 'file-op';

    command: string;

    requiresConfirmation: boolean;

    riskLevel: 'safe' | 'moderate' | 'dangerous';

    originalMessage: string;

    args?: string[];

    confidence: number;
}

export interface ProjectScripts {
    [scriptName: string]: string;
}

export type ProjectType = 'node' | 'python' | 'rust' | 'go' | 'unknown';
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'pip' | 'poetry' | 'cargo' | 'go' | 'unknown';

export interface ProjectContext {
    type: ProjectType;
    packageManager: PackageManager;
    scripts?: ProjectScripts;
}

export function detectProjectContext(
    availableFiles: Array<{ path: string; type: 'file' | 'directory' }>,
    projectScripts: ProjectScripts = {}
): ProjectContext {
    let projectType: ProjectType = 'unknown';
    let packageManager: PackageManager = 'unknown';

    if (availableFiles.some(f => f.path === 'package.json')) {
        projectType = 'node';
        packageManager = 'npm'; 
        if (availableFiles.some(f => f.path === 'yarn.lock')) packageManager = 'yarn';
        else if (availableFiles.some(f => f.path === 'pnpm-lock.yaml')) packageManager = 'pnpm';
        else if (availableFiles.some(f => f.path === 'bun.lockb')) packageManager = 'bun';
    }
    else if (availableFiles.some(f => f.path === 'requirements.txt' || f.path === 'pyproject.toml' || f.path.endsWith('.py'))) {
        projectType = 'python';
        packageManager = 'pip';
        if (availableFiles.some(f => f.path === 'poetry.lock')) packageManager = 'poetry';
    }
    else if (availableFiles.some(f => f.path === 'Cargo.toml')) {
        projectType = 'rust';
        packageManager = 'cargo';
    }
    else if (availableFiles.some(f => f.path === 'go.mod' || f.path.endsWith('.go'))) {
        projectType = 'go';
        packageManager = 'go';
    }

    return {
        type: projectType,
        packageManager,
        scripts: projectScripts
    };
}

export function parsePackageJson(packageJsonContent: string): ProjectScripts {
    try {
        const pkg = JSON.parse(packageJsonContent);
        return pkg.scripts || {};
    } catch (error) {
        console.error('Failed to parse package.json:', error);
        return {};
    }
}

export function getSuggestedCommands(projectType: string, scripts: ProjectScripts): string[] {
    const suggestions: string[] = [];

    if (scripts.build) suggestions.push('build');
    if (scripts.test) suggestions.push('test');
    if (scripts.dev || scripts.start) suggestions.push('dev server');
    if (scripts.lint) suggestions.push('lint');
    if (scripts.format) suggestions.push('format');

    switch (projectType) {
        case 'typescript':
        case 'javascript':
            suggestions.push('install dependencies', 'show package.json');
            break;
        case 'python':
            suggestions.push('install requirements', 'show requirements.txt');
            break;
        case 'go':
            suggestions.push('go build', 'go test');
            break;
        case 'rust':
            suggestions.push('cargo build', 'cargo test');
            break;
    }

    return suggestions;
}
