

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { agentOrchestrator } from '../agents/AgentOrchestrator';
import { modelRouter } from '../ai/ModelRouter';
import { projectBrain } from '../brain/ProjectBrain';
import { memoryEngine } from '../memory/MemoryEngine';
import { logger } from '../utils/logger';
import { SYSTEM_INSTRUCTION } from '../webview/src/constants/query-default-instructions';
import { terminalManager } from '../terminal/TerminalManager';
import { TerminalLocation } from '../types/terminalTypes';
import { PROMPTS } from '../config/prompts';

export class WebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codemind.panel';
  private _view?: vscode.WebviewView;
  private _activeQueryController?: AbortController;
  private runningTerminals: Map<string, vscode.Terminal> = new Map();

  constructor(private readonly _extensionUri: vscode.Uri) {
    this.initializeTerminalCallbacks();
  }

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

    this._setWebviewMessageListener(webviewView.webview);
    logger.info('WebviewProvider: Message listener set up');

    this.sendStatus();
    this.sendActiveTasks();

    this.setupFileWatcher();

    webviewView.onDidDispose(() => {
      this.dispose();
    });

    logger.info('WebviewProvider: Initial data sent');
  }

  private fileWatcher?: vscode.FileSystemWatcher;
  private refreshTimeout?: NodeJS.Timeout;

  private setupFileWatcher() {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
    }

    this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');

    const refresh = () => this.debouncedRefresh();

    this.fileWatcher.onDidCreate(refresh);
    this.fileWatcher.onDidDelete(refresh);
    this.fileWatcher.onDidChange(refresh);
  }

  private debouncedRefresh() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    this.refreshTimeout = setTimeout(() => {
      logger.info('WebviewProvider: File system change detected, refreshing tree');
      this.sendStatus();
    }, 1000);
  }

  public dispose() {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = undefined;
    }
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
  }

  private async loadLastSession() {
    const filePath = this.getHistoryFilePath();
    if (filePath && fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const history = JSON.parse(content);
        if (history.sessions && history.sessions.length > 0) {
          const lastSession = history.sessions[0];
          if (this._view) {
            this._view.webview.postMessage({
              type: 'loadChat',
              data: lastSession
            });

            setTimeout(() => {
              if (this._view) {
                this._view.webview.postMessage({
                  type: 'setCurrentSession',
                  sessionId: lastSession.id
                });
              }
            }, 100);
          }
        }
      } catch (error) {
        logger.error('Failed to load last session', error as Error);
      }
    }
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
        case 'stopQuery':
          await this.handleStopQuery();
          break;
        case 'runCommand':
          // Handle runCommand from frontend (useTerminal hook)
          await this.handleExecuteTerminalCommand(message.command, message.cwd, 'chat', message.commandId);
          break;
        case 'executeTerminalCommand':
          await this.handleExecuteTerminalCommand(message.command, message.cwd, message.location, message.commandId);
          break;
        case 'stopTerminalCommand':
          await this.handleStopTerminalCommand(message.commandId);
          break;
        case 'getRunningCommands':
          await this.handleGetRunningCommands();
          break;
        case 'readFile':
          await this.handleReadFile(message.path);
          break;
        case 'openFile':
          await this.handleOpenFile(message.path);
          break;
        case 'analyzeCommand':
          await this.handleAnalyzeCommand(message.data, message.messageId);
          break;
        case 'getSettings':
          await this.handleGetSettings();
          break;
        case 'updateSettings':
          await this.handleUpdateSettings(message.settings);
          break;
        case 'terminalRelocate':
          await this.handleTerminalRelocate(message.commandId);
          break;
        case 'webviewReady':
          // Don't automatically load last session - let the frontend's state persistence handle it
          // Only load on explicit user action (clicking history)
          /*
          setTimeout(() => {
            this.loadLastSession();
          }, 100);
          */
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

    const workspaceFiles = await this.getWorkspaceFilesAndDirectories();

    const config = vscode.workspace.getConfiguration('codemind');
    const activeModel = config.get<string>('primaryModel') || 'gpt-4o-mini';

    logger.info(`WebviewProvider: Sending status with activeModel: ${activeModel}`);

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
        files: workspaceFiles,
        activeModel: activeModel,
        platform: os.platform()
      }
    });
  }

  private async getWorkspaceFilesAndDirectories(): Promise<Array<{ path: string; type: 'file' | 'directory' }>> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const items: Array<{ path: string; type: 'file' | 'directory' }> = [];
    const directories = new Set<string>();

    try {
      const files = await vscode.workspace.findFiles(
        '**/*',
        '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/build/**,**/.vscode-test/**}',
        1000
      );

      for (const file of files) {
        const relativePath = path.relative(workspaceRoot, file.fsPath);

        items.push({ path: relativePath, type: 'file' });

        const parts = relativePath.split(path.sep);
        for (let i = 1; i < parts.length; i++) {
          const dirPath = parts.slice(0, i).join(path.sep);
          if (dirPath && !directories.has(dirPath)) {
            directories.add(dirPath);
            items.push({ path: dirPath, type: 'directory' });
          }
        }
      }

      items.sort((a, b) => {
        if (a.type === b.type) {
          return a.path.localeCompare(b.path);
        }
        return a.type === 'directory' ? -1 : 1;
      });

      return items;
    } catch (error) {
      logger.error('Failed to get workspace files', error as Error);
      return [];
    }
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

      if (history.sessions.length > 50) {
        history.sessions = history.sessions.slice(0, 50);
      }

      fs.writeFileSync(filePath, JSON.stringify(history, null, 2));

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

  private async handleStopQuery() {
    logger.info('WebviewProvider: Stop query requested');

    if (this._activeQueryController) {
      this._activeQueryController.abort();
      this._activeQueryController = undefined;

      logger.info('WebviewProvider: Query aborted');

      if (this._view) {
        this._view.webview.postMessage({
          type: 'queryResponse',
          data: {
            loading: false,
            response: 'Query stopped by user',
            success: false,
            cancelled: true
          }
        });
      }
    } else {
      logger.warn('WebviewProvider: No active query to stop');
    }
  }

  private async handleModelSelection(model: string) {
    await vscode.workspace.getConfiguration('codemind').update(
      'primaryModel',
      model,
      vscode.ConfigurationTarget.Global
    );

    vscode.window.showInformationMessage(`Model selected: ${model}`);
  }

  private async handleQuery(query: string, modelId?: string) {
    logger.info(`WebviewProvider: Handling query: "${query}" with model: ${modelId}`);

    if (!this._view) {
      logger.error('WebviewProvider: View is undefined');
      return;
    }

    if (this._activeQueryController) {
      this._activeQueryController.abort();
    }

    this._activeQueryController = new AbortController();
    const signal = this._activeQueryController.signal;

    try {
      logger.info('WebviewProvider: Sending loading state to webview');
      this._view.webview.postMessage({
        type: 'queryResponse',
        data: { loading: true }
      });

      if (signal.aborted) {
        throw new Error('Query was cancelled');
      }

      logger.info('WebviewProvider: Parsing query...');
      const { cleanQuery, files, command } = await this.parseQuery(query);
      logger.info(`WebviewProvider: Parsed query. Command: ${command}, Files: ${files.length}`);

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
          case 'agent':
          case 'advanced':
            agentType = 'langchain';
            break;
          default:
            agentType = 'coder';
        }
      }

      const task: any = {
        id: `query-${Date.now()}`,
        type: agentType,
        description: cleanQuery,
        context: {
          files: files.map(f => f.path),
          userPrompt: this.buildPromptWithFiles(cleanQuery, files),
          modelId: modelId
        },
        priority: 1,
        status: 'pending',
        createdAt: Date.now()
      };

      logger.info(`WebviewProvider: Executing task ${task.id}`);

      const timeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out after 30 seconds')), 30000);
      });

      const executionPromise = agentOrchestrator.executeTask(task);

      const result: any = await Promise.race([executionPromise, timeoutPromise]);
      if (result.success) {
        const responseData = {
          loading: false,
          response: result.output || 'Query completed successfully',
          success: true,
          referencedFiles: files,
          commandId: result.commandIds && result.commandIds.length > 0 ? result.commandIds[0] : undefined
        };

        if (responseData.commandId) {
          const terminalStartedMessage = {
            type: 'terminalCommandStarted',
            commandId: responseData.commandId,
            command: 'Script execution',
            success: true
          };
          this._view.webview.postMessage(terminalStartedMessage);

          await new Promise(resolve => setTimeout(resolve, 100));
        }

        this._view.webview.postMessage({
          type: 'queryResponse',
          data: responseData
        });

        setTimeout(() => {
          this.sendStatus();
        }, 100);

        setTimeout(() => {
          this.sendStatus();
        }, 1000);

        setTimeout(() => {
          this.sendStatus();
        }, 2000);
      } else {
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
      if (signal.aborted || error.message === 'Query was cancelled') {
        logger.info('WebviewProvider: Query was cancelled');
        return;
      }

      logger.error('WebviewProvider: Error handling query', error);
      this._view.webview.postMessage({
        type: 'queryResponse',
        data: {
          loading: false,
          response: `Error: ${error.message || 'An unexpected error occurred'}`,
          success: false
        }
      });
    } finally {
      if (this._activeQueryController?.signal === signal) {
        this._activeQueryController = undefined;
      }
    }
  }

  private async parseQuery(query: string): Promise<{ cleanQuery: string; files: Array<{ path: string; content: string; relativePath?: string; resolutionMethod?: string }>; command?: string }> {
    const files: Array<{ path: string; content: string; relativePath?: string; resolutionMethod?: string }> = [];
    let command: string | undefined;
    let cleanQuery = query;

    const fileMatchesIterator = query.matchAll(/@([\w\-\.\/\\]+(?:\.[a-zA-Z0-9]+)?)/g);
    for (const match of fileMatchesIterator) {
      const fileRef = match[1];
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspaceRoot) {
        let filePath = fileRef;
        let fileUri: vscode.Uri | null = null;
        let resolutionMethod = 'none';

        try {
          const possiblePath = path.join(workspaceRoot, fileRef);
          if (fs.existsSync(possiblePath)) {
            filePath = possiblePath;
            fileUri = vscode.Uri.file(possiblePath);
            resolutionMethod = 'workspace-relative';
            logger.info(`✅ Found via workspace-relative: ${filePath}`);
          } else if (fs.existsSync(fileRef)) {
            filePath = fileRef;
            fileUri = vscode.Uri.file(fileRef);
            resolutionMethod = 'absolute';
          } else {
            const searchPatterns = [
              `**/${fileRef}`,
              `**/*${fileRef}*`,
              `**/${fileRef}.*`,
            ];

            for (const pattern of searchPatterns) {
              const foundFiles = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 5);
              if (foundFiles.length > 0) {
                let bestFile = foundFiles[0];
                let bestMtime = 0;

                for (const file of foundFiles) {
                  try {
                    const stat = await vscode.workspace.fs.stat(file);
                    if (stat.mtime > bestMtime) {
                      bestMtime = stat.mtime;
                      bestFile = file;
                    }
                  } catch {
                    logger.warn(`Error finding file: ${pattern}`);
                  }
                }

                fileUri = bestFile;
                filePath = fileUri.fsPath;
                resolutionMethod = `workspace-search (${foundFiles.length} matches)`;
                logger.info(`✅ Selected best match: ${filePath} (modified: ${new Date(bestMtime).toISOString()})`);
                break;
              } else {
                logger.info(`  No matches for pattern: ${pattern}`);
              }
            }
          }
        } catch (e) {
          logger.error(`❌ Error resolving file path: ${fileRef}`, e as Error);
          resolutionMethod = 'error';
        }

        if (!fileUri) {
          logger.warn(`❌ No file found for reference: @${fileRef}`);
          resolutionMethod = 'not-found';
        }

        if (fileUri) {
          try {
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            const content = Buffer.from(fileContent).toString('utf8');
            const relativePath = vscode.workspace.asRelativePath(filePath);

            files.push({
              path: filePath,
              content,
              relativePath,
              resolutionMethod
            });

            logger.info(`📄 Successfully loaded file: ${relativePath} (${content.length} bytes) via ${resolutionMethod}`);
          } catch (error) {
            logger.error(`❌ Failed to read file ${filePath}:`, error as Error);
            files.push({
              path: filePath,
              content: `// Error: Could not read file content\n// Path: ${filePath}`,
              relativePath: vscode.workspace.asRelativePath(filePath),
              resolutionMethod: 'read-error'
            });
          }
        } else {
          logger.warn(`❌ Could not resolve file reference: @${fileRef} (resolution method: ${resolutionMethod})`);
          files.push({
            path: fileRef,
            content: `// File not found: ${fileRef}\n// Please check the file path and try again`,
            relativePath: fileRef,
            resolutionMethod: resolutionMethod
          });
        }
      }

      cleanQuery = cleanQuery.replace(match[0], `[referenced: ${fileRef}]`).trim();
    }

    const commandMatch = query.match(/^\/(\w+)\s*/);
    if (commandMatch) {
      command = commandMatch[1];
      cleanQuery = cleanQuery.replace(commandMatch[0], '').trim();
    }

    return { cleanQuery, files, command };
  }


  private buildPromptWithFiles(cleanQuery: string, files: Array<{ path: string; content: string; relativePath?: string; resolutionMethod?: string }>): string {
    let prompt = cleanQuery;

    if (files.length > 0) {
      prompt += '\n\n## Referenced Files\n\n';
      for (const file of files) {
        const displayPath = file.relativePath || vscode.workspace.asRelativePath(file.path);
        prompt += `### File: ${displayPath}\n\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
      }
    }

    prompt += `\n\n${SYSTEM_INSTRUCTION}`;
    return prompt;
  }

  public refreshWebview() {
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview(this._view.webview);
      logger.info('WebviewProvider: Webview refreshed with new HTML');
    }
  }
  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'assets', 'index.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'assets', 'index.css'));

    const nonce = getNonce();

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

  /**
   * Initialize terminal manager callbacks
   */
  private initializeTerminalCallbacks(): void {
    terminalManager.setOnOutput((commandId, line) => {
      if (this._view) {
        this._view.webview.postMessage({
          type: 'terminalOutput',
          commandId,
          output: line
        });
      }
    });

    terminalManager.setOnStatus((commandId, status, pid) => {
      if (this._view) {
        this._view.webview.postMessage({
          type: 'terminalStatus',
          commandId,
          status,
          pid
        });
      }
    });

    terminalManager.setOnComplete((commandId, exitCode, duration, status) => {
      if (this._view) {
        this._view.webview.postMessage({
          type: 'terminalComplete',
          commandId,
          exitCode,
          duration,
          status
        });
      }
    });
  }

  private async handleExecuteTerminalCommand(
    command: string,
    cwd?: string,
    location?: string,
    commandId?: string
  ): Promise<void> {
    logger.info(`Executing terminal command: ${command} (ID: ${commandId})`);

    try {
      const termLocation = location === 'main' ? TerminalLocation.MAIN : TerminalLocation.CHAT;
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      const result = await terminalManager.executeCommand(command, {
        cwd: cwd || workspaceRoot,
        location: termLocation,
        id: commandId
      });

      if (this._view) {
        this._view.webview.postMessage({
          type: 'terminalCommandStarted',
          commandId: result.commandId,
          command: command, // Add the actual command string
          success: result.success,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('Failed to execute terminal command', error as Error);

      if (this._view) {
        this._view.webview.postMessage({
          type: 'terminalCommandStarted',
          success: false,
          error: (error as Error).message
        });
      }
    }
  }

  private async handleStopTerminalCommand(commandId: string): Promise<void> {
    logger.info(`Stopping terminal command: ${commandId}`);

    const stopped = terminalManager.stopCommand(commandId);

    if (this._view) {
      this._view.webview.postMessage({
        type: 'terminalCommandStopped',
        commandId,
        stopped
      });
    }
  }

  private async handleGetRunningCommands(): Promise<void> {
    const commands = terminalManager.getRunningCommands();

    if (this._view) {
      this._view.webview.postMessage({
        type: 'runningCommands',
        commands
      });
    }
  }

  private async handleReadFile(filePath: string): Promise<void> {
    if (!this._view) return;

    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        throw new Error('No workspace open');
      }

      const fullPath = path.join(workspaceRoot, filePath);

      if (!fullPath.startsWith(workspaceRoot)) {
        throw new Error('Access denied: Path outside workspace');
      }

      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        this._view.webview.postMessage({
          type: 'fileContent',
          path: filePath,
          content: content
        });
      } else {
        this._view.webview.postMessage({
          type: 'fileContent',
          path: filePath,
          error: 'File not found'
        });
      }
    } catch (error) {
      logger.error(`Failed to read file ${filePath}`, error as Error);
      this._view.webview.postMessage({
        type: 'fileContent',
        path: filePath,
        error: (error as Error).message
      });
    }
  }

  private async handleOpenFile(filePath: string): Promise<void> {
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace open');
        return;
      }

      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceRoot, filePath);

      if (!fullPath.startsWith(workspaceRoot)) {
        vscode.window.showErrorMessage('Cannot open file outside workspace');
        return;
      }

      if (fs.existsSync(fullPath)) {
        const fileUri = vscode.Uri.file(fullPath);
        const document = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(document, {
          preview: false,
          viewColumn: vscode.ViewColumn.One
        });
        logger.info(`Opened file: ${fullPath}`);
      } else {
        vscode.window.showErrorMessage(`File not found: ${filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to open file ${filePath}`, error as Error);
      vscode.window.showErrorMessage(`Failed to open file: ${(error as Error).message}`);
    }
  }

  private async handleAnalyzeCommand(requestData: any, messageId: string): Promise<void> {
    if (!this._view) return;

    try {
      const { userQuery, projectContext, availableFiles, platform } = requestData;

      const fileContext = availableFiles && availableFiles.length > 0
        ? `\nAvailable Files/Directories (sample):\n${availableFiles.slice(0, 20).map((f: any) => `- ${f.path} (${f.type})`).join('\n')}`
        : '';

      const prompt = PROMPTS.COMMAND_ANALYSIS({
        projectType: projectContext.type,
        packageManager: projectContext.packageManager,
        scripts: Object.keys(projectContext.scripts || {}).join(', ') || 'None',
        platform,
        availableFiles: fileContext,
        userQuery
      });

      const aiResponse = await modelRouter.generateCompletion({
        prompt,
        temperature: 0.3,
        maxTokens: 500
      });

      let analysisResult: any = { isCommand: false };
      try {
        const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        logger.error('Failed to parse AI command analysis response', parseError as Error);
      }

      if (this._view) {
        this._view.webview.postMessage({
          type: 'commandAnalysisResponse',
          messageId,
          data: analysisResult
        });
      }

    } catch (error) {
      logger.error('AI command analysis failed', error as Error);

      if (this._view) {
        this._view.webview.postMessage({
          type: 'commandAnalysisResponse',
          messageId,
          data: { isCommand: false, error: (error as Error).message }
        });
      }
    }
  }

  private async handleGetSettings(): Promise<void> {
    if (!this._view) return;

    const config = vscode.workspace.getConfiguration('codemind');

    const settings = {
      primaryModel: config.get('primaryModel', 'gemini-pro'),
      turboMode: config.get('turboMode', false),
      enableAutoFallback: config.get('enableAutoFallback', true),
      cacheEmbeddings: config.get('cacheEmbeddings', true),
      enableLocalModels: config.get('enableLocalModels', false),
      apiKeys: {
        gemini: config.get('geminiApiKey', ''),
        openai: config.get('openaiApiKey', ''),
        anthropic: config.get('anthropicApiKey', ''),
        deepseek: config.get('deepseekApiKey', ''),
        groq: config.get('groqApiKey', '')
      }
    };

    this._view.webview.postMessage({
      type: 'currentSettings',
      data: settings
    });
  }

  private async handleUpdateSettings(settings: any): Promise<void> {
    if (!this._view) return;

    const config = vscode.workspace.getConfiguration('codemind');

    try {
      await config.update('primaryModel', settings.primaryModel, vscode.ConfigurationTarget.Global);
      await config.update('turboMode', settings.turboMode, vscode.ConfigurationTarget.Global);
      await config.update('enableAutoFallback', settings.enableAutoFallback, vscode.ConfigurationTarget.Global);
      await config.update('cacheEmbeddings', settings.cacheEmbeddings, vscode.ConfigurationTarget.Global);
      await config.update('enableLocalModels', settings.enableLocalModels, vscode.ConfigurationTarget.Global);

      if (settings.apiKeys) {
        await config.update('geminiApiKey', settings.apiKeys.gemini || '', vscode.ConfigurationTarget.Global);
        await config.update('openaiApiKey', settings.apiKeys.openai || '', vscode.ConfigurationTarget.Global);
        await config.update('anthropicApiKey', settings.apiKeys.anthropic || '', vscode.ConfigurationTarget.Global);
        await config.update('deepseekApiKey', settings.apiKeys.deepseek || '', vscode.ConfigurationTarget.Global);
        await config.update('groqApiKey', settings.apiKeys.groq || '', vscode.ConfigurationTarget.Global);
      }

      vscode.window.showInformationMessage('CodeMind settings saved successfully!');

      await this.handleGetSettings();
    } catch (error) {
      logger.error('Failed to save settings', error as Error);
      vscode.window.showErrorMessage('Failed to save settings: ' + (error as Error).message);
    }
  }

  private async handleTerminalRelocate(commandId: string): Promise<void> {
    logger.info(`Relocating terminal for command: ${commandId}`);

    try {
      const command = terminalManager.getCommand(commandId);
      if (!command) {
        logger.warn(`Command ${commandId} not found in terminal manager`);
        vscode.window.showWarningMessage('Terminal command not found');
        return;
      }

      const terminal = vscode.window.createTerminal({
        name: `CodeMind: ${command.command.substring(0, 30)}...`,
        cwd: command.cwd
      });

      terminal.show(true);

      const process = terminalManager.getProcess(commandId);
      if (process && !process.killed) {
        logger.info(`Stopping background process for command ${commandId} to relocate to main terminal`);
        terminalManager.stopCommand(commandId);

        setTimeout(() => {
          terminal.sendText(command.command);
        }, 500);
      } else {
        terminal.sendText(`# Command completed in chat terminal`);
        terminal.sendText(`# Command: ${command.command}`);
        terminal.sendText(`# Working directory: ${command.cwd}`);
        terminal.sendText(`# Status: ${command.status}`);
        if (command.exitCode !== undefined) {
          terminal.sendText(`# Exit code: ${command.exitCode}`);
        }
        logger.info(`Opened main terminal for completed command: ${commandId} (not re-running)`);
      }

      this.runningTerminals.set(commandId, terminal);

      vscode.window.onDidCloseTerminal((closedTerminal) => {
        if (closedTerminal === terminal) {
          this.runningTerminals.delete(commandId);
          logger.info(`Cleaned up relocated terminal for command: ${commandId}`);
        }
      });

      if (this._view) {
        this._view.webview.postMessage({
          type: 'terminalRelocated',
          commandId,
          success: true
        });
      }
    } catch (error) {
      logger.error(`Failed to relocate terminal for command ${commandId}`, error as Error);
      vscode.window.showErrorMessage('Failed to relocate terminal: ' + (error as Error).message);

      if (this._view) {
        this._view.webview.postMessage({
          type: 'terminalRelocated',
          commandId,
          success: false,
          error: (error as Error).message
        });
      }
    }
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