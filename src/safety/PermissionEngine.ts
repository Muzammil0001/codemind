/**
 * Permission Engine - Core safety system for user approval
 */

import * as vscode from 'vscode';
import { ActionRequest, PermissionLevel, PermissionDecision, RiskLevel } from '../types';
import { PermissionMemory } from './PermissionMemory';
import { configManager } from '../config/settings';
import { logger } from '../utils/logger';

export class PermissionEngine {
    private permissionMemory: PermissionMemory;
    private pendingRequests: Map<string, (decision: PermissionDecision) => void> = new Map();

    constructor(context: vscode.ExtensionContext) {
        this.permissionMemory = new PermissionMemory(context);
    }

    async requestPermission(action: ActionRequest): Promise<PermissionDecision> {
        // Check if action is safe enough to auto-approve
        if (this.canAutoApprove(action)) {
            logger.info(`Auto-approved safe action: ${action.description}`);
            return {
                actionId: action.id,
                decision: 'allow-once',
                timestamp: Date.now()
            };
        }

        // Check permission memory
        const remembered = await this.permissionMemory.getPermission(action.category);

        if (remembered === 'always-allow') {
            logger.info(`Auto-approved from memory: ${action.description}`);
            return {
                actionId: action.id,
                decision: 'always-allow',
                timestamp: Date.now()
            };
        }

        if (remembered === 'deny') {
            logger.info(`Auto-denied from memory: ${action.description}`);
            return {
                actionId: action.id,
                decision: 'deny',
                timestamp: Date.now(),
                reason: 'Previously denied by user'
            };
        }

        // Request user approval
        return await this.showApprovalDialog(action);
    }

    private async showApprovalDialog(action: ActionRequest): Promise<PermissionDecision> {
        const riskIcon = this.getRiskIcon(action.riskLevel);
        const message = `${riskIcon} ${action.description}\n\n` +
            `Impact: ${action.estimatedImpact}\n` +
            `Affected files: ${action.affectedFiles.length}\n` +
            `Reversible: ${action.reversible ? 'Yes' : 'No'}`;

        const options = [
            { label: '✓ Allow Once', value: 'allow-once' as PermissionLevel },
            { label: '✓✓ Always Allow', value: 'always-allow' as PermissionLevel },
            { label: '? Always Ask', value: 'always-ask' as PermissionLevel },
            { label: '✗ Deny', value: 'deny' as PermissionLevel }
        ];

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: message,
            title: 'CodeMind AI - Permission Required'
        });

        if (!selected) {
            return {
                actionId: action.id,
                decision: 'deny',
                timestamp: Date.now(),
                reason: 'User cancelled'
            };
        }

        // Save to memory if always-allow or deny
        if (selected.value === 'always-allow' || selected.value === 'deny') {
            await this.permissionMemory.setPermission(action.category, selected.value);
        }

        logger.info(`User decision for ${action.description}: ${selected.value}`);

        return {
            actionId: action.id,
            decision: selected.value,
            timestamp: Date.now()
        };
    }

    private canAutoApprove(action: ActionRequest): boolean {
        const safetyLevel = configManager.getSafetyLevel();

        // Strict mode: never auto-approve
        if (safetyLevel === 'strict') {
            return action.riskLevel === 'safe';
        }

        // Moderate mode: auto-approve safe and some moderate actions
        if (safetyLevel === 'moderate') {
            return action.riskLevel === 'safe' ||
                (action.riskLevel === 'moderate' && action.reversible);
        }

        // Relaxed mode: auto-approve safe and moderate actions
        if (safetyLevel === 'relaxed') {
            return action.riskLevel !== 'critical';
        }

        return false;
    }

    private getRiskIcon(riskLevel: RiskLevel): string {
        switch (riskLevel) {
            case 'safe':
                return '✅';
            case 'moderate':
                return '⚠️';
            case 'high':
                return '🔶';
            case 'critical':
                return '🔴';
        }
    }

    async clearPermissions(): Promise<void> {
        await this.permissionMemory.clearAll();
        vscode.window.showInformationMessage('All permission preferences cleared');
    }

    async showPermissionSettings(): Promise<void> {
        const stats = await this.permissionMemory.getPermissionStats();
        const permissions = await this.permissionMemory.getAllPermissions();

        const items = Array.from(permissions.entries()).map(([category, entry]) => ({
            label: category,
            description: `${entry.decision} (used ${entry.useCount} times)`,
            category,
            entry
        }));

        if (items.length === 0) {
            vscode.window.showInformationMessage('No saved permissions');
            return;
        }

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `${stats.total} saved permissions (${stats.alwaysAllow} always-allow, ${stats.alwaysDeny} denied)`,
            title: 'CodeMind AI - Permission Settings'
        });

        if (selected) {
            const action = await vscode.window.showQuickPick([
                { label: 'Remove Permission', value: 'remove' },
                { label: 'Cancel', value: 'cancel' }
            ]);

            if (action?.value === 'remove') {
                await this.permissionMemory.removePermission(selected.category);
                vscode.window.showInformationMessage(`Permission removed for ${selected.category}`);
            }
        }
    }

    getPermissionMemory(): PermissionMemory {
        return this.permissionMemory;
    }
}
