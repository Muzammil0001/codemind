/**
 * Diff Generator - Creates and applies code diffs
 */

import { FileDiff, DiffHunk, DiffLine } from '../types';
import * as Diff from 'diff';

export class DiffGenerator {
    generateDiff(original: string, modified: string): FileDiff {
        const patches = Diff.createPatch('file', original, modified);
        const hunks = this.parsePatches(patches, original, modified);
        const stats = this.calculateStats(hunks);

        return {
            original,
            modified,
            hunks,
            stats
        };
    }

    private parsePatches(patches: string, original: string, modified: string): DiffHunk[] {
        const hunks: DiffHunk[] = [];
        const lines = patches.split('\n');

        let currentHunk: DiffHunk | null = null;
        let lineNumber = 0;

        for (const line of lines) {
            // Parse hunk header
            if (line.startsWith('@@')) {
                const match = line.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
                if (match) {
                    if (currentHunk) {
                        hunks.push(currentHunk);
                    }

                    currentHunk = {
                        oldStart: parseInt(match[1]),
                        oldLines: parseInt(match[2]),
                        newStart: parseInt(match[3]),
                        newLines: parseInt(match[4]),
                        lines: []
                    };
                    lineNumber = parseInt(match[3]);
                }
            } else if (currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
                const type = line.startsWith('+') ? 'add' :
                    line.startsWith('-') ? 'delete' : 'context';

                currentHunk.lines.push({
                    type,
                    content: line.slice(1),
                    lineNumber: type === 'delete' ? -1 : lineNumber++
                });
            }
        }

        if (currentHunk) {
            hunks.push(currentHunk);
        }

        return hunks;
    }

    private calculateStats(hunks: DiffHunk[]): {
        additions: number;
        deletions: number;
        changes: number;
    } {
        let additions = 0;
        let deletions = 0;

        for (const hunk of hunks) {
            for (const line of hunk.lines) {
                if (line.type === 'add') {
                    additions++;
                } else if (line.type === 'delete') {
                    deletions++;
                }
            }
        }

        return {
            additions,
            deletions,
            changes: additions + deletions
        };
    }

    applyDiff(original: string, diff: FileDiff): string {
        return diff.modified;
    }

    formatDiff(diff: FileDiff): string {
        let output = '';

        output += `Changes: +${diff.stats.additions} -${diff.stats.deletions}\n\n`;

        for (const hunk of diff.hunks) {
            output += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;

            for (const line of hunk.lines) {
                const prefix = line.type === 'add' ? '+' :
                    line.type === 'delete' ? '-' : ' ';
                output += `${prefix}${line.content}\n`;
            }

            output += '\n';
        }

        return output;
    }

    generateMinimalDiff(original: string, modified: string): {
        startLine: number;
        endLine: number;
        replacement: string;
    }[] {
        const changes: {
            startLine: number;
            endLine: number;
            replacement: string;
        }[] = [];

        const diff = this.generateDiff(original, modified);

        for (const hunk of diff.hunks) {
            const newLines: string[] = [];

            for (const line of hunk.lines) {
                if (line.type !== 'delete') {
                    newLines.push(line.content);
                }
            }

            changes.push({
                startLine: hunk.oldStart,
                endLine: hunk.oldStart + hunk.oldLines - 1,
                replacement: newLines.join('\n')
            });
        }

        return changes;
    }
}

export const diffGenerator = new DiffGenerator();
