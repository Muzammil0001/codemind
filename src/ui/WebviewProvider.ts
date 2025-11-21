/**
 * Webview Provider - Manages the React UI panel
 */

import * as vscode from 'vscode';
import { agentOrchestrator } from '../agents/AgentOrchestrator';
import { modelRouter } from '../ai/ModelRouter';
import { projectBrain } from '../brain/ProjectBrain';
import { memoryEngine } from '../memory/MemoryEngine';

export class WebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codemind.panel';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'getStatus':
                    await this.sendStatus();
                    break;
                case 'getActiveTasks':
                    await this.sendActiveTasks();
                    break;
                case 'getMemoryStats':
                    await this.sendMemoryStats();
                    break;
                case 'selectModel':
                    await this.handleModelSelection(data.model);
                    break;
            }
        });

        // Send initial data
        this.sendStatus();
    }

    private async sendStatus() {
        if (!this._view) {
            return;
        }

        const providerStatus = await modelRouter.getProviderStatus();
        const brainState = projectBrain.getState();
        const memoryStats = memoryEngine.getStatistics();

        this._view.webview.postMessage({
            type: 'status',
            data: {
                providers: Array.from(providerStatus.entries()),
                brainState: brainState ? {
                    fileCount: brainState.fileCount,
                    frameworks: brainState.frameworks.map(f => f.name),
                    lastAnalyzed: brainState.lastAnalyzed
                } : null,
                memory: memoryStats
            }
        });
    }

    private async sendActiveTasks() {
        if (!this._view) {
            return;
        }

        const tasks = agentOrchestrator.getActiveTasks();

        this._view.webview.postMessage({
            type: 'activeTasks',
            data: tasks
        });
    }

    private async sendMemoryStats() {
        if (!this._view) {
            return;
        }

        const stats = memoryEngine.getStatistics();
        const recentMemories = await memoryEngine.getRecentMemories(10);

        this._view.webview.postMessage({
            type: 'memoryStats',
            data: {
                stats,
                recent: recentMemories
            }
        });
    }

    private async handleModelSelection(model: string) {
        // Update configuration
        await vscode.workspace.getConfiguration('codemind').update(
            'primaryModel',
            model,
            vscode.ConfigurationTarget.Global
        );

        vscode.window.showInformationMessage(`Primary model set to: ${model}`);
    }

    private _getHtmlForWebview(_webview: vscode.Webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeMind AI</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 16px;
    }

    .section {
      margin-bottom: 24px;
      padding: 16px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
    }

    h2 {
      font-size: 18px;
      margin-bottom: 12px;
      color: var(--vscode-textLink-foreground);
    }

    h3 {
      font-size: 14px;
      margin-bottom: 8px;
      color: var(--vscode-textPreformat-foreground);
    }

    .status-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .status-item:last-child {
      border-bottom: none;
    }

    .status-label {
      font-weight: 500;
    }

    .status-value {
      color: var(--vscode-descriptionForeground);
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }

    .badge-success {
      background-color: var(--vscode-testing-iconPassed);
      color: white;
    }

    .badge-error {
      background-color: var(--vscode-testing-iconFailed);
      color: white;
    }

    .badge-warning {
      background-color: var(--vscode-testing-iconQueued);
      color: white;
    }

    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      margin-right: 8px;
      margin-top: 8px;
    }

    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    select {
      background-color: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      padding: 6px 12px;
      border-radius: 4px;
      width: 100%;
      margin-top: 8px;
    }

    .task-item {
      padding: 12px;
      margin-bottom: 8px;
      background-color: var(--vscode-editor-background);
      border-left: 3px solid var(--vscode-textLink-foreground);
      border-radius: 4px;
    }

    .task-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .task-description {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state {
      text-align: center;
      padding: 24px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="section">
    <h2>🤖 CodeMind AI Dashboard</h2>
    <div class="status-item">
      <span class="status-label">Status</span>
      <span class="status-value"><span class="badge badge-success">Active</span></span>
    </div>
  </div>

  <div class="section">
    <h3>AI Providers</h3>
    <div id="providers">
      <div class="empty-state">Loading...</div>
    </div>
  </div>

  <div class="section">
    <h3>Model Selection</h3>
    <select id="modelSelect">
      <option value="groq-llama-3.1-70b">Groq LLaMA 3.1 70B (Fast)</option>
      <option value="deepseek-coder">DeepSeek Coder (Code)</option>
      <option value="gemini-flash-2.0">Gemini Flash 2.0 (Large Context)</option>
      <option value="ollama-local">Ollama (Local)</option>
      <option value="lmstudio-local">LM Studio (Local)</option>
    </select>
    <button onclick="selectModel()">Set Primary Model</button>
  </div>

  <div class="section">
    <h3>Project Intelligence</h3>
    <div id="brainState">
      <div class="empty-state">No project analyzed yet</div>
    </div>
  </div>

  <div class="section">
    <h3>Active Tasks</h3>
    <div id="activeTasks">
      <div class="empty-state">No active tasks</div>
    </div>
    <button onclick="refreshTasks()">Refresh</button>
  </div>

  <div class="section">
    <h3>Memory</h3>
    <div id="memoryStats">
      <div class="empty-state">Loading...</div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // Request initial data
    vscode.postMessage({ type: 'getStatus' });
    vscode.postMessage({ type: 'getActiveTasks' });
    vscode.postMessage({ type: 'getMemoryStats' });

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'status':
          updateStatus(message.data);
          break;
        case 'activeTasks':
          updateActiveTasks(message.data);
          break;
        case 'memoryStats':
          updateMemoryStats(message.data);
          break;
      }
    });

    function updateStatus(data) {
      // Update providers
      const providersDiv = document.getElementById('providers');
      if (data.providers && data.providers.length > 0) {
        providersDiv.innerHTML = data.providers.map(([name, available]) => \`
          <div class="status-item">
            <span class="status-label">\${name}</span>
            <span class="status-value">
              <span class="badge \${available ? 'badge-success' : 'badge-error'}">
                \${available ? 'Available' : 'Unavailable'}
              </span>
            </span>
          </div>
        \`).join('');
      }

      // Update brain state
      const brainDiv = document.getElementById('brainState');
      if (data.brainState) {
        brainDiv.innerHTML = \`
          <div class="status-item">
            <span class="status-label">Files Analyzed</span>
            <span class="status-value">\${data.brainState.fileCount}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Frameworks</span>
            <span class="status-value">\${data.brainState.frameworks.join(', ') || 'None'}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Last Analyzed</span>
            <span class="status-value">\${new Date(data.brainState.lastAnalyzed).toLocaleString()}</span>
          </div>
        \`;
      }
    }

    function updateActiveTasks(tasks) {
      const tasksDiv = document.getElementById('activeTasks');
      
      if (tasks && tasks.length > 0) {
        tasksDiv.innerHTML = tasks.map(task => \`
          <div class="task-item">
            <div class="task-header">
              <strong>\${task.type}</strong>
              <span class="badge badge-warning">\${task.status}</span>
            </div>
            <div class="task-description">\${task.description}</div>
          </div>
        \`).join('');
      } else {
        tasksDiv.innerHTML = '<div class="empty-state">No active tasks</div>';
      }
    }

    function updateMemoryStats(data) {
      const memoryDiv = document.getElementById('memoryStats');
      
      if (data && data.stats) {
        const types = Object.entries(data.stats.byType).map(([type, count]) => 
          \`\${type}: \${count}\`
        ).join(', ');

        memoryDiv.innerHTML = \`
          <div class="status-item">
            <span class="status-label">Total Memories</span>
            <span class="status-value">\${data.stats.total}</span>
          </div>
          <div class="status-item">
            <span class="status-label">By Type</span>
            <span class="status-value">\${types || 'None'}</span>
          </div>
        \`;
      }
    }

    function selectModel() {
      const select = document.getElementById('modelSelect');
      vscode.postMessage({
        type: 'selectModel',
        model: select.value
      });
    }

    function refreshTasks() {
      vscode.postMessage({ type: 'getActiveTasks' });
    }

    // Auto-refresh every 5 seconds
    setInterval(() => {
      vscode.postMessage({ type: 'getStatus' });
      vscode.postMessage({ type: 'getActiveTasks' });
    }, 5000);
  </script>
</body>
</html>`;
    }
}
