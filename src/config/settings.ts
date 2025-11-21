/**
 * Extension settings and configuration management
 */

import * as vscode from 'vscode';
import { ExtensionConfig } from '../types';

export class ConfigManager {
    private static instance: ConfigManager;
    private config: vscode.WorkspaceConfiguration;

    private constructor() {
        this.config = vscode.workspace.getConfiguration('codemind');
    }

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    refresh(): void {
        this.config = vscode.workspace.getConfiguration('codemind');
    }

    getConfig(): ExtensionConfig {
        return {
            primaryModel: this.config.get('primaryModel', 'groq-llama-3.1-70b'),
            enableAutoFallback: this.config.get('enableAutoFallback', true),
            enableLocalModels: this.config.get('enableLocalModels', false),
            ollamaUrl: this.config.get('ollamaUrl', 'http://localhost:11434'),
            lmstudioUrl: this.config.get('lmstudioUrl', 'http://localhost:1234'),
            apiKeys: {
                groq: this.config.get('groqApiKey'),
                deepseek: this.config.get('deepseekApiKey'),
                gemini: this.config.get('geminiApiKey'),
                openai: this.config.get('openaiApiKey'),
                anthropic: this.config.get('anthropicApiKey')
            },
            enableInlineSuggestions: this.config.get('enableInlineSuggestions', true),
            enableCodebaseAnalysis: this.config.get('enableCodebaseAnalysis', true),
            turboMode: this.config.get('turboMode', false),
            safetyLevel: this.config.get('safetyLevel', 'strict'),
            theme: this.config.get('theme', 'auto'),
            maxContextLines: this.config.get('maxContextLines', 1000),
            enableParallelExecution: this.config.get('enableParallelExecution', true),
            cacheEmbeddings: this.config.get('cacheEmbeddings', true)
        };
    }

    get<T>(key: string, defaultValue?: T): T {
        return this.config.get(key, defaultValue as T);
    }

    async set(key: string, value: any, global: boolean = false): Promise<void> {
        await this.config.update(
            key,
            value,
            global ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace
        );
        this.refresh();
    }

    getApiKey(provider: string): string | undefined {
        return this.config.get(`${provider}ApiKey`);
    }

    async setApiKey(provider: string, key: string): Promise<void> {
        await this.set(`${provider}ApiKey`, key, true);
    }

    isPrimaryModel(modelId: string): boolean {
        return this.config.get('primaryModel') === modelId;
    }

    async setPrimaryModel(modelId: string): Promise<void> {
        await this.set('primaryModel', modelId, true);
    }

    isTurboMode(): boolean {
        return this.config.get('turboMode', false);
    }

    async toggleTurboMode(): Promise<boolean> {
        const current = this.isTurboMode();
        await this.set('turboMode', !current, false);
        return !current;
    }

    getSafetyLevel(): 'strict' | 'moderate' | 'relaxed' {
        return this.config.get('safetyLevel', 'strict');
    }

    isFeatureEnabled(feature: string): boolean {
        return this.config.get(`enable${feature}`, true);
    }
}

export const configManager = ConfigManager.getInstance();
