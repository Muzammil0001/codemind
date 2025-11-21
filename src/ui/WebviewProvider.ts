/**
 * Webview Provider - Manages the React UI panel
 */

import * as vscode from 'vscode';
import { agentOrchestrator } from '../agents/AgentOrchestrator';
import { modelRouter } from '../ai/ModelRouter';
import { projectBrain } from '../brain/ProjectBrain';
import { memoryEngine } from '../memory/MemoryEngine';
import { logger } from '../utils/logger';

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

    // Set up message listener
    this._setWebviewMessageListener(webviewView.webview);

    // Send initial data
    this.sendStatus();
    this.sendActiveTasks();
  }

  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(async (message: any) => {
      const command = message.type;
      const text = message.text;

      logger.info(`WebviewProvider: Received message type: ${command}`);

      switch (command) {
        case 'log':
          logger.info(`Webview Log: ${text}`);
          return;
        case 'error':
          logger.error(`Webview Error: ${text}`);
          vscode.window.showErrorMessage(text);
          return;
        case 'hello':
          vscode.window.showInformationMessage(text);
          return;
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
          await this.handleModelSelection(message.model);
          break;
        case 'executeQuery':
          logger.info('WebviewProvider: Execute query command received');
          await this.handleQuery(message.query);
          break;
      }
    });
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

  private async handleQuery(query: string) {
    logger.info(`WebviewProvider: Handling query: "${query}"`);

    if (!this._view) {
      logger.error('WebviewProvider: View is undefined');
      return;
    }

    try {
      // Send loading state
      logger.info('WebviewProvider: Sending loading state to webview');
      this._view.webview.postMessage({
        type: 'queryResponse',
        data: { loading: true }
      });

      // Parse query for @ file references and / commands
      logger.info('WebviewProvider: Parsing query...');
      const { cleanQuery, files, command } = await this.parseQuery(query);
      logger.info(`WebviewProvider: Parsed query. Command: ${command}, Files: ${files.length}`);

      // Determine agent type based on command
      let agentType: any = 'coder';
      if (command) {
        switch (command) {
          case 'explain':
            agentType = 'documenter';
            break;
          case 'refactor':
            agentType = 'coder';
            break;
          case 'test':
            agentType = 'tester';
            break;
          case 'doc':
          case 'document':
            agentType = 'documenter';
            break;
          case 'review':
            agentType = 'reviewer';
            break;
          default:
            agentType = 'coder';
        }
      }

      // Create proper agent task
      const task: any = {
        id: `query-${Date.now()}`,
        type: agentType,
        description: cleanQuery,
        context: {
          files: files,
          userPrompt: cleanQuery
        },
        priority: 1,
        status: 'pending',
        createdAt: Date.now()
      };

      // Execute query through agent orchestrator with timeout
      logger.info(`WebviewProvider: Executing task ${task.id}`);

      const timeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out after 30 seconds')), 30000);
      });

      const executionPromise = agentOrchestrator.executeTask(task);

      // Race between execution and timeout
      const result: any = await Promise.race([executionPromise, timeoutPromise]);

      logger.info(`WebviewProvider: Task ${task.id} completed with success=${result.success}`);

      // Send response
      if (result.success) {
        this._view.webview.postMessage({
          type: 'queryResponse',
          data: {
            loading: false,
            response: result.output || 'Query completed successfully',
            success: true,
            referencedFiles: files
          }
        });
      } else {
        // Handle agent failure
        const errorMessage = result.warnings && result.warnings.length > 0 ? result.warnings[0] : 'Unknown error occurred';
        this._view.webview.postMessage({
          type: 'queryResponse',
          data: {
            loading: false,
            response: `Error: ${errorMessage}`,
            success: false
          }
        });
      }
    } catch (error: any) {
      logger.error('WebviewProvider: Error handling query', error);
      // Send error
      this._view.webview.postMessage({
        type: 'queryResponse',
        data: {
          loading: false,
          response: `Error: ${error.message || 'An unexpected error occurred'}`,
          success: false
        }
      });
    }
  }

  private async parseQuery(query: string): Promise<{ cleanQuery: string; files: string[]; command?: string }> {
    const files: string[] = [];
    let command: string | undefined;
    let cleanQuery = query;

    // Parse @ file references
    const fileMatches = query.matchAll(/@([\w\-\.\/]+)/g);
    for (const match of fileMatches) {
      const fileRef = match[1];

      // Try to resolve file path
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspaceRoot) {
        const filePath = `${workspaceRoot}/${fileRef}`;

        // Check if file exists
        try {
          await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
          files.push(filePath);
        } catch {
          // File doesn't exist, try without workspace root
          try {
            await vscode.workspace.fs.stat(vscode.Uri.file(fileRef));
            files.push(fileRef);
          } catch {
            logger.info(`File not found: ${fileRef}`);
          }
        }
      }

      // Remove @ reference from query
      cleanQuery = cleanQuery.replace(match[0], '').trim();
    }

    // Parse / command
    const commandMatch = query.match(/^\/(\w+)\s*/);
    if (commandMatch) {
      command = commandMatch[1];
      cleanQuery = cleanQuery.replace(commandMatch[0], '').trim();
    }

    return { cleanQuery, files, command };
  }

  private _getHtmlForWebview(_webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
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

    textarea, input[type="text"] {
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 8px 12px;
      border-radius: 4px;
      width: 100%;
      margin-top: 8px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      resize: vertical;
    }

    textarea {
      min-height: 80px;
    }

    .query-response {
      margin-top: 12px;
      padding: 12px;
      background-color: var(--vscode-editor-background);
      border-radius: 4px;
      border-left: 3px solid var(--vscode-textLink-foreground);
      white-space: pre-wrap;
      font-family: var(--vscode-editor-font-family);
      font-size: 13px;
    }

    .query-response.error {
      border-left-color: var(--vscode-testing-iconFailed);
      color: var(--vscode-errorForeground);
    }

    .loading {
      opacity: 0.6;
      font-style: italic;
    }

    .file-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .file-chip {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 12px;
      font-size: 11px;
      font-family: var(--vscode-editor-font-family);
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
      <option value="groq-mixtral-8x7b">Groq Mixtral 8x7B</option>
      <option value="groq-llama-3.1-8b">Groq LLaMA 3.1 8B (Fastest)</option>
      <option value="deepseek-coder">DeepSeek Coder (Code Specialist)</option>
      <option value="deepseek-chat">DeepSeek Chat</option>
      <option value="gemini-pro">Gemini Pro (32K context)</option>
      <option value="openai-gpt-4o-mini">OpenAI GPT-4o Mini</option>
      <option value="claude-haiku">Claude Haiku</option>
      <option value="ollama-local">Ollama (Local)</option>
      <option value="lmstudio-local">LM Studio (Local)</option>
    </select>
    <button onclick="selectModel()">Set Primary Model</button>
  </div>

  <div class="section">
    <h3>Ask AI Agent</h3>
    <textarea id="queryInput" onkeydown="handleQueryKeydown(event)" placeholder="Ask me anything...

Examples:
• @WebviewProvider.ts explain this file
• /refactor make this code cleaner
• @models.ts /review check for issues
• Create a React component for user login

Tip: Press Enter to submit, Ctrl+Enter for new line"></textarea>
    <button onclick="executeQuery()">Ask AI</button>
    <div id="queryResponse" style="display: none;"></div>
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

    // Global error handler
    window.onerror = function(message, source, lineno, colno, error) {
      vscode.postMessage({
        type: 'error',
        text: \`Webview Error: \${message} at \${source}:\${lineno}:\${colno}\`
      });
    };

    console.log('Webview script loaded');
    vscode.postMessage({ type: 'log', text: 'Webview script loaded' });

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
        case 'queryResponse':
          updateQueryResponse(message.data);
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

    function handleQueryKeydown(event) {
      // Submit on Enter (without Ctrl/Cmd)
      if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        executeQuery();
      }
      // Allow Ctrl+Enter or Cmd+Enter for new line (default behavior)
    }

    function executeQuery() {
      const input = document.getElementById('queryInput');
      const responseDiv = document.getElementById('queryResponse');
      const query = input.value.trim();

      if (!query) {
        return;
      }

      // Show loading state
      responseDiv.style.display = 'block';
      responseDiv.className = 'query-response loading';
      responseDiv.textContent = 'Processing your query...';

      // Send query to extension
      vscode.postMessage({
        type: 'executeQuery',
        query: query
      });
    }

    function updateQueryResponse(data) {
      const responseDiv = document.getElementById('queryResponse');
      
      if (data.loading) {
        responseDiv.style.display = 'block';
        responseDiv.className = 'query-response loading';
        responseDiv.textContent = 'Processing your query...';
      } else {
        responseDiv.style.display = 'block';
        responseDiv.className = data.success ? 'query-response' : 'query-response error';
        
        // Build response HTML
        let html = '<div>' + data.response + '</div>';
        
        // Add referenced files if any
        if (data.referencedFiles && data.referencedFiles.length > 0) {
          html += '<div class="file-chips">';
          data.referencedFiles.forEach(file => {
            const fileName = file.split('/').pop();
            html += '<span class="file-chip">📄 ' + fileName + '</span>';
          });
          html += '</div>';
        }
        
        responseDiv.innerHTML = html;
      }
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
