

import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import { diff_match_patch, Diff, patch_obj } from 'diff-match-patch';
import type { BaseTool, ToolResult, PatchResult, FilePatchOptions } from './types';
import { logger } from '../utils/logger';

export class FilePatchTool implements BaseTool {
    name = 'file_patch';
    description = 'Apply intelligent file patches with conflict detection and resolution';

    private dmp: diff_match_patch;

    constructor() {
        this.dmp = new diff_match_patch();
    }

    async execute(options: FilePatchOptions): Promise<ToolResult<PatchResult>> {
        try {
            const {
                filePath,
                patch,
                createBackup = true,
                validateBeforeApply = true,
                resolveConflicts = 'fail'
            } = options;

            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                throw new Error('No workspace folder open');
            }

            const fullPath = path.join(workspaceRoot, filePath);

            if (!await fs.pathExists(fullPath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const originalContent = await fs.readFile(fullPath, 'utf-8');

            let backupPath: string | undefined;
            if (createBackup) {
                backupPath = `${fullPath}.backup.${Date.now()}`;
                await fs.writeFile(backupPath, originalContent);
            }

            const patches = this.dmp.patch_fromText(patch);
            const [patchedContent, results] = this.dmp.patch_apply(patches, originalContent);

            const conflicts: PatchResult['conflicts'] = [];
            let hasConflicts = false;

            for (let i = 0; i < results.length; i++) {
                if (!results[i]) {
                    hasConflicts = true;
                    const patchObj = patches[i];
                    conflicts.push({
                        line: patchObj.start1 || 0,
                        original: originalContent.split('\n')[patchObj.start1 || 0] || '',
                        proposed: patchObj.diffs.map(d => d[1]).join('')
                    });
                }
            }

            if (hasConflicts) {
                if (resolveConflicts === 'fail') {
                    throw new Error(`Patch has conflicts. ${conflicts.length} conflict(s) detected.`);
                } else if (resolveConflicts === 'auto') {
                    logger.warn('Auto-resolving conflicts with fuzzy matching');
                } else {
                    throw new Error('Manual conflict resolution required');
                }
            }

            if (validateBeforeApply) {
                const isValid = await this.validatePatch(fullPath, patchedContent);
                if (!isValid) {
                    throw new Error('Patch validation failed - would create invalid code');
                }
            }

            await fs.writeFile(fullPath, patchedContent);

            const changes = this.calculateChanges(originalContent, patchedContent);

            return {
                success: true,
                data: {
                    success: true,
                    filePath,
                    changes,
                    conflicts: conflicts.length > 0 ? conflicts : undefined,
                    backup: backupPath
                }
            };
        } catch (error) {
            logger.error('File patch failed', error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    private async validatePatch(filePath: string, content: string): Promise<boolean> {
        try {
            const ext = path.extname(filePath);

            if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
                const openBraces = (content.match(/\{/g) || []).length;
                const closeBraces = (content.match(/\}/g) || []).length;
                const openParens = (content.match(/\(/g) || []).length;
                const closeParens = (content.match(/\)/g) || []).length;

                return openBraces === closeBraces && openParens === closeParens;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    private calculateChanges(original: string, patched: string): PatchResult['changes'] {
        const diffs = this.dmp.diff_main(original, patched);
        this.dmp.diff_cleanupSemantic(diffs);

        let additions = 0;
        let deletions = 0;
        let modifications = 0;

        for (const [op, text] of diffs) {
            const lines = text.split('\n').length - 1;

            if (op === 1) { 
                additions += lines;
            } else if (op === -1) { 
                deletions += lines;
            } else { 
                modifications += 0;
            }
        }

        return { additions, deletions, modifications };
    }

    async createPatch(filePath: string, newContent: string): Promise<string> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder open');
        }

        const fullPath = path.join(workspaceRoot, filePath);
        const originalContent = await fs.readFile(fullPath, 'utf-8');

        const diffs = this.dmp.diff_main(originalContent, newContent);
        const patches = this.dmp.patch_make(originalContent, diffs);

        return this.dmp.patch_toText(patches);
    }

    async applyMultiplePatches(patches: Array<{ filePath: string; patch: string }>): Promise<ToolResult<PatchResult[]>> {
        const results: PatchResult[] = [];
        const errors: string[] = [];

        for (const { filePath, patch } of patches) {
            const result = await this.execute({ filePath, patch });

            if (result.success && result.data) {
                results.push(result.data);
            } else {
                errors.push(`${filePath}: ${result.error}`);
            }
        }

        if (errors.length > 0) {
            return {
                success: false,
                error: `Failed to apply ${errors.length} patch(es):\n${errors.join('\n')}`
            };
        }

        return {
            success: true,
            data: results
        };
    }
}
