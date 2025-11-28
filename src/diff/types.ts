

export interface DiffResult {
    original: string;
    modified: string;
    changes: Change[];
    stats: DiffStats;
}

export interface Change {
    type: 'add' | 'delete' | 'equal';
    content: string;
    lineNumber?: number;
}

export interface DiffStats {
    additions: number;
    deletions: number;
    filesChanged: number;
}

export interface MergeResult {
    success: boolean;
    content: string;
    conflicts: Conflict[];
}

export interface Conflict {
    start: number;
    end: number;
    base: string;
    ours: string;
    theirs: string;
}
