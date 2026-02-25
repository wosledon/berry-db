/**
 * Redis CLI 终端 Webview
 */

import * as vscode from 'vscode';

export class RedisCliProvider {
  public static readonly viewType = 'berry-db.redisCli';
  private _panel?: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _connectionId?: string;

  constructor(private readonly extensionPath: string) {}

  public async show(connectionId: string): Promise<void> {
    this._connectionId = connectionId;

    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.Two);
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      RedisCliProvider.viewType,
      'Redis CLI',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(this.extensionPath)],
        retainContextWhenHidden: true
      }
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this.getHtmlContent();
    
    // 监听消息
    this._panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'execute':
          await this.executeCommand(message.commandText);
          break;
      }
    });
  }

  private async executeCommand(commandText: string): Promise<void> {
    try {
      if (!this._connectionId) {
        this.sendResponse('错误：未连接', false);
        return;
      }

      // TODO: 实际执行 Redis 命令
      this.sendResponse(`执行：${commandText}\n(功能实现中...)`, true);
    } catch (error: any) {
      this.sendResponse(`错误：${error.message}`, false);
    }
  }

  private sendResponse(response: string, success: boolean): void {
    this._panel?.webview.postMessage({
      command: 'response',
      response,
      success
    });
  }

  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redis CLI</title>
  <style>
    :root {
      --vscode-foreground: #cccccc;
      --vscode-editor-background: #1e1e1e;
      --vscode-input-background: #3c3c3c;
      --vscode-input-foreground: #cccccc;
      --vscode-button-background: #0e639c;
      --vscode-button-foreground: #ffffff;
      --vscode-terminal-ansiRed: #f44336;
      --vscode-terminal-ansiGreen: #4caf50;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Consolas', 'Courier New', monospace;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .toolbar {
      display: flex;
      gap: 10px;
      padding: 8px;
      border-bottom: 1px solid var(--vscode-input-background);
      align-items: center;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
    }
    button:hover { opacity: 0.9; }
    .output {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
      font-size: 13px;
      line-height: 1.5;
    }
    .output-line { margin: 2px 0; white-space: pre-wrap; word-break: break-all; }
    .output-line.command { color: #569cd6; }
    .output-line.response { color: var(--vscode-foreground); }
    .output-line.error { color: var(--vscode-terminal-ansiRed); }
    .output-line.info { color: #888; }
    .input-area {
      display: flex;
      border-top: 1px solid var(--vscode-input-background);
      padding: 8px;
      gap: 8px;
    }
    .prompt {
      color: #4caf50;
      padding: 8px;
      font-weight: bold;
    }
    #commandInput {
      flex: 1;
      background: var(--vscode-input-background);
      border: 1px solid transparent;
      color: var(--vscode-input-foreground);
      padding: 8px;
      font-family: inherit;
      font-size: 13px;
      outline: none;
    }
    #commandInput:focus { border-color: var(--vscode-button-background); }
    .help {
      padding: 10px;
      background: rgba(14, 99, 156, 0.1);
      border-radius: 4px;
      margin-bottom: 10px;
    }
    .help code {
      background: var(--vscode-input-background);
      padding: 2px 6px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="clearOutput()">🗑️ 清空</button>
    <button onclick="showHelp()">❓ 帮助</button>
    <span style="margin-left: auto; color: #888; font-size: 12px;">Redis CLI</span>
  </div>
  
  <div class="output" id="output"></div>
  
  <div class="input-area">
    <span class="prompt">redis&gt;</span>
    <input 
      type="text" 
      id="commandInput" 
      placeholder="输入 Redis 命令，如：GET key, SET key value, HGETALL hash"
      autofocus
      onkeydown="handleKeyDown(event)"
    />
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const output = document.getElementById('output');
    const commandInput = document.getElementById('commandInput');
    
    // 显示欢迎信息
    addOutput('欢迎使用 Redis CLI!', 'info');
    addOutput('输入命令并按 Enter 执行', 'info');
    addOutput('常用命令：GET, SET, DEL, KEYS *, HGETALL, LPUSH, RPOP, SMEMBERS, ZRANGE', 'info');
    addOutput('', '');

    function handleKeyDown(event) {
      if (event.key === 'Enter') {
        const command = commandInput.value.trim();
        if (command) {
          addOutput('redis> ' + command, 'command');
          vscode.postMessage({ command: 'execute', commandText: command });
          commandInput.value = '';
        }
      }
    }

    function addOutput(text, type) {
      const line = document.createElement('div');
      line.className = 'output-line ' + type;
      line.textContent = text;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
    }

    function clearOutput() {
      output.innerHTML = '';
      addOutput('输出已清空', 'info');
    }

    function showHelp() {
      addOutput('', '');
      addOutput('=== Redis CLI 帮助 ===', 'info');
      addOutput('字符串：GET key, SET key value, INCR key, DECR key', 'info');
      addOutput('哈希：HGET key field, HSET key field value, HGETALL key, HDEL key field', 'info');
      addOutput('列表：LPUSH key value, RPUSH key value, LPOP key, RPOP key, LRANGE key start stop', 'info');
      addOutput('集合：SADD key member, SMEMBERS key, SREM key member, SCARD key', 'info');
      addOutput('有序集合：ZADD key score member, ZRANGE key start stop, ZRANK key member', 'info');
      addOutput('通用：DEL key, TYPE key, TTL key, KEYS pattern, EXISTS key', 'info');
      addOutput('', '');
    }

    // 监听来自扩展的消息
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'response') {
        addOutput(message.response, message.success ? 'response' : 'error');
      }
    });
  </script>
</body>
</html>`;
  }

  public appendOutput(text: string, type: 'command' | 'response' | 'error' | 'info' = 'response'): void {
    this._panel?.webview.postMessage({
      command: 'appendOutput',
      text,
      type
    });
  }

  private dispose(): void {
    this._panel = undefined;
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }
}
