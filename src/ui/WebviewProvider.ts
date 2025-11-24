/**
 * Webview Provider - Manages the React UI panel
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { agentOrchestrator } from '../agents/AgentOrchestrator';
import { modelRouter } from '../ai/ModelRouter';
import { projectBrain } from '../brain/ProjectBrain';
import { memoryEngine } from '../memory/MemoryEngine';
import { logger } from '../utils/logger';
import { SYSTEM_INSTRUCTION } from '../webview/src/constants/query-default-instructions';

export class WebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codemind.panel';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    logger.info('WebviewProvider: resolveWebviewView called');
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri,
        vscode.Uri.joinPath(this._extensionUri, 'out', 'webview')
      ]
    };
    logger.info('WebviewProvider: Webview options set');

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    logger.info('WebviewProvider: HTML content set');

    // Set up message listener
    this._setWebviewMessageListener(webviewView.webview);
    logger.info('WebviewProvider: Message listener set up');

    // Send initial data
    this.sendStatus();
    this.sendActiveTasks();
    logger.info('WebviewProvider: Initial data sent');
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
          await this.handleQuery(message.query, message.model);
          break;
        case 'saveChat':
          await this.handleSaveChat(message.session);
          break;
        case 'getHistory':
          await this.handleGetHistory();
          break;
        case 'loadChat':
          await this.handleLoadChat(message.id);
          break;
        case 'deleteChat':
          await this.handleDeleteChat(message.id);
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

    // Get file list for @ mentions
    let files: string[] = [];
    if (brainState && brainState.dependencyGraph) {
      files = Array.from(brainState.dependencyGraph.nodes.keys());
    }

    const config = vscode.workspace.getConfiguration('codemind');
    const activeModel = config.get<string>('primaryModel') || 'gemini-1.5-flash';

    this._view.webview.postMessage({
      type: 'status',
      data: {
        providers: Array.from(providerStatus.entries()),
        brainState: brainState ? {
          fileCount: brainState.fileCount,
          frameworks: brainState.frameworks.map(f => f.name),
          lastAnalyzed: brainState.lastAnalyzed
        } : null,
        memory: memoryStats,
        files: files, // Send files for autocomplete
        activeModel: activeModel
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

  private getHistoryFilePath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }
    const codemindDir = path.join(workspaceFolders[0].uri.fsPath, '.codemind');
    if (!fs.existsSync(codemindDir)) {
      fs.mkdirSync(codemindDir, { recursive: true });
    }
    return path.join(codemindDir, 'history.json');
  }

  private async handleSaveChat(session: any) {
    const filePath = this.getHistoryFilePath();
    if (!filePath) return;

    try {
      let history: any = { sessions: [] };
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        history = JSON.parse(content);
      }

      const existingIndex = history.sessions.findIndex((s: any) => s.id === session.id);
      if (existingIndex >= 0) {
        history.sessions[existingIndex] = session;
      } else {
        history.sessions.unshift(session);
      }

      // Limit history to 50 sessions
      if (history.sessions.length > 50) {
        history.sessions = history.sessions.slice(0, 50);
      }

      fs.writeFileSync(filePath, JSON.stringify(history, null, 2));

      // Refresh history list for frontend
      await this.handleGetHistory();
    } catch (error) {
      logger.error('Failed to save chat history', error as Error);
    }
  }

  private async handleGetHistory() {
    if (!this._view) return;

    const filePath = this.getHistoryFilePath();
    let sessions: any[] = [];

    if (filePath && fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const history = JSON.parse(content);
        // Return only metadata (preview) to save bandwidth
        sessions = history.sessions.map((s: any) => ({
          id: s.id,
          title: s.title,
          timestamp: s.timestamp,
          preview: s.preview || (s.messages[0]?.content || '').slice(0, 100)
        }));
      } catch (error) {
        logger.error('Failed to read chat history', error as Error);
      }
    }

    this._view.webview.postMessage({
      type: 'historyList',
      data: sessions
    });
  }

  private async handleLoadChat(id: string) {
    if (!this._view) return;

    const filePath = this.getHistoryFilePath();
    if (filePath && fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const history = JSON.parse(content);
        const session = history.sessions.find((s: any) => s.id === id);

        if (session) {
          this._view.webview.postMessage({
            type: 'loadChat',
            data: session
          });
        }
      } catch (error) {
        logger.error('Failed to load chat session', error as Error);
      }
    }
  }

  private async handleDeleteChat(id: string) {
    const filePath = this.getHistoryFilePath();
    if (!filePath) return;

    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        let history = JSON.parse(content);
        history.sessions = history.sessions.filter((s: any) => s.id !== id);
        fs.writeFileSync(filePath, JSON.stringify(history, null, 2));

        await this.handleGetHistory();
      }
    } catch (error) {
      logger.error('Failed to delete chat session', error as Error);
    }
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

  private async handleQuery(query: string, modelId?: string) {
    logger.info(`WebviewProvider: Handling query: "${query}" with model: ${modelId}`);

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
          userPrompt: `${cleanQuery}\n\n${SYSTEM_INSTRUCTION}`,
          modelId: modelId // Pass selected model ID
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
      logger.info(`WebProvider query reponse=${result}`);
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

  private _getHtmlForWebview(webview: vscode.Webview) {
    logger.info('WebviewProvider: Generating HTML for webview');
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'assets', 'index.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'assets', 'index.css'));

    logger.info(`WebviewProvider: Script URI: ${scriptUri.toString()}`);
    logger.info(`WebviewProvider: Style URI: ${styleUri.toString()}`);

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();
    logger.info(`WebviewProvider: Generated nonce for CSP`);

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; script-src-elem 'nonce-${nonce}'; connect-src ${webview.cspSource};">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleUri}" rel="stylesheet">
        <title>CodeMind AI</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          window.vscode = vscode;
          window.onerror = function(message, source, lineno, colno, error) {
            vscode.postMessage({
              type: 'error',
              text: 'ERROR: ' + message + ' at ' + source + ':' + lineno + ':' + colno
            });
            return true;
          };
          window.addEventListener('unhandledrejection', function(event) {
            vscode.postMessage({
              type: 'error',
              text: 'Unhandled Promise Rejection: ' + event.reason
            });
          });
          console.log('Webview initializing...');
          vscode.postMessage({ type: 'log', text: 'Webview script loaded' });
        </script>
        <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}