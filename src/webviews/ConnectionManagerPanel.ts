/**
 * 连接管理面板 - Datagrip 风格
 */

import * as vscode from 'vscode';
import { ConnectionManager } from '../services/ConnectionManager';

export class ConnectionManagerPanelProvider {
  public static readonly viewType = 'berry-db.connectionManager';
  private _panel?: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionPath: string,
    private readonly connectionManager: ConnectionManager
  ) {}

  public async show(): Promise<void> {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.One);
      this.refresh();
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      ConnectionManagerPanelProvider.viewType,
      '连接管理',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(this.extensionPath)],
        retainContextWhenHidden: true
      }
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(message => this.handleMessage(message), null, this._disposables);
    this.updateContent();
  }

  private updateContent(): void {
    if (!this._panel) return;
    this._panel.webview.html = this.getHtmlContent();
  }

  public refresh(): void {
    this.updateContent();
  }

  private handleMessage(message: any): void {
    switch (message.command) {
      case 'connect':
        this.connect(message.id);
        break;
      case 'disconnect':
        this.disconnect(message.id);
        break;
      case 'edit':
        this.edit(message.id);
        break;
      case 'delete':
        this.delete(message.id);
        break;
      case 'test':
        this.test(message.id);
        break;
    }
  }

  private async connect(id: string): Promise<void> {
    await vscode.commands.executeCommand('berry-db.connect', id);
    this.refresh();
  }

  private async disconnect(id: string): Promise<void> {
    await vscode.commands.executeCommand('berry-db.disconnect', id);
    this.refresh();
  }

  private async edit(id: string): Promise<void> {
    await vscode.commands.executeCommand('berry-db.editConnection', id);
    this.refresh();
  }

  private async delete(id: string): Promise<void> {
    await vscode.commands.executeCommand('berry-db.deleteConnection', id);
    this.refresh();
  }

  private async test(id: string): Promise<void> {
    const conn = this.connectionManager.getConnection(id);
    if (!conn) return;

    try {
      const service: any = await this.connectionManager.getService(id);
      await service.connect();
      await service.disconnect();
      vscode.window.showInformationMessage(`✅ 连接 "${conn.name}" 测试成功`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`❌ 连接 "${conn.name}" 测试失败：${error.message}`);
    }
  }

  private getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      sqlite: '📄',
      postgresql: '🐘',
      mysql: '🐬',
      redis: '🔴'
    };
    return icons[type] || '📦';
  }

  private getHtmlContent(): string {
    const connections = this.connectionManager.getAllConnections();
    const connectedIds = new Set(
      connections.filter(c => this.connectionManager.isConnected(c.id)).map(c => c.id)
    );

    let rowsHtml = '';
    if (connections.length === 0) {
      rowsHtml = `
        <tr>
          <td colspan="6" class="empty-cell">
            <div class="empty-state">
              <div class="empty-icon">📦</div>
              <div class="empty-title">暂无连接</div>
              <button class="btn-primary" onclick="addConnection()">添加连接</button>
            </div>
          </td>
        </tr>
      `;
    } else {
      rowsHtml = connections.map(conn => {
        const isConnected = connectedIds.has(conn.id);
        const statusClass = isConnected ? 'status-connected' : 'status-disconnected';
        const statusText = isConnected ? '已连接' : '未连接';
        const statusIcon = isConnected ? '✓' : '✗';
        const actionBtn = isConnected
          ? `<button class="btn-danger" onclick="disconnect(event, '${conn.id}')">断开</button>`
          : `<button class="btn-primary" onclick="connect(event, '${conn.id}')">连接</button>`;

        return `
        <tr>
          <td>${conn.name}</td>
          <td><span class="badge badge-${conn.type}">${this.getTypeIcon(conn.type)}</span> ${conn.type.toUpperCase()}</td>
          <td>${conn.host || conn.filePath || '-'}</td>
          <td class="status-cell"><span class="status ${statusClass}">${statusIcon} ${statusText}</span></td>
          <td class="actions-cell">
            ${actionBtn}
            <button class="btn-secondary" onclick="edit(event, '${conn.id}')">编辑</button>
            <button class="btn-danger" onclick="deleteQuery(event, '${conn.id}')">删除</button>
            <button class="btn-icon" onclick="test(event, '${conn.id}')">测试</button>
          </td>
        </tr>
        `;
      }).join('');
    }

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>连接管理 - Berry DB</title>
  <style>
    :root {
      --bg-primary: #1e1e1e;
      --bg-secondary: #252526;
      --bg-tertiary: #2d2d2d;
      --border-color: #3e3e42;
      --text-primary: #cccccc;
      --text-secondary: #858585;
      --accent-color: #0e639c;
      --success-color: #4caf50;
      --error-color: #f44336;
      --warning-color: #ff9800;
      --font-family: 'Segoe UI', sans-serif;
      --font-mono: 'Consolas', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-family);
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 13px;
      line-height: 1.5;
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
    }

    .header h2 { font-size: 14px; font-weight: 600; }
    .btn { padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 12px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); }
    .btn:hover { background: var(--accent-color); color: white; border-color: var(--accent-color); }
    .btn-primary { background: var(--accent-color); color: white; border-color: var(--accent-color); }
    .btn-success { background: var(--success-color); color: white; border-color: var(--success-color); }

    .toolbar { padding: 8px 16px; background: var(--bg-primary); border-bottom: 1px solid var(--border-color); }
    .stats { display: flex; gap: 20px; font-size: 12px; }
    .stat-item { display: flex; align-items: center; gap: 6px; }
    .stat-value { font-weight: 600; font-family: var(--font-mono); }
    .stat-connected { color: var(--success-color); }

    .table-container {
      flex: 1;
      overflow: auto;
      background: var(--bg-primary);
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .data-table th {
      background: var(--bg-secondary);
      border-bottom: 2px solid var(--accent-color);
      padding: 10px 16px;
      text-align: left;
      font-weight: 600;
      position: sticky;
      top: 0;
    }

    .data-table td {
      border-bottom: 1px solid var(--border-color);
      padding: 10px 16px;
    }

    .data-table tr:hover td { background: var(--bg-secondary); }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; margin-right: 4px; }
    .badge-sqlite { background: #8d6e63; color: white; }
    .badge-postgresql { background: #42a5f5; color: white; }
    .badge-mysql { background: #ef5350; color: white; }
    .badge-redis { background: #ec407a; color: white; }

    .status { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 3px; font-size: 11px; font-weight: 600; }
    .status-connected { background: rgba(76, 175, 80, 0.1); color: var(--success-color); }
    .status-disconnected { background: rgba(244, 67, 54, 0.1); color: var(--error-color); }

    .actions-cell { display: flex; gap: 6px; flex-wrap: wrap; }
    .btn-secondary { background: var(--bg-tertiary); }
    .btn-secondary:hover { background: var(--accent-color); border-color: var(--accent-color); }
    .btn-danger { background: var(--error-color); color: white; border-color: var(--error-color); }
    .btn-danger:hover { opacity: 0.9; }
    .btn-icon { padding: 4px 8px; font-size: 14px; background: var(--bg-tertiary); }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-secondary);
      padding: 40px;
    }
    .empty-icon { font-size: 64px; margin-bottom: 20px; opacity: 0.3; }
    .empty-title { font-size: 16px; margin-bottom: 8px; color: var(--text-primary); }

    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: var(--accent-color);
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s;
      z-index: 1000;
    }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast.success { background: var(--success-color); }
    .toast.error { background: var(--error-color); }

    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: var(--bg-primary); }
    ::-webkit-scrollbar-thumb {
      background: var(--bg-secondary);
      border-radius: 5px;
      border: 2px solid var(--bg-primary);
    }
    ::-webkit-scrollbar-thumb:hover { background: var(--bg-tertiary); }
  </style>
</head>
<body>
  <div class="header">
    <h2>📦 连接管理</h2>
    <button class="btn-success" onclick="addConnection()">+ 添加连接</button>
  </div>

  <div class="toolbar">
    <div class="stats">
      <div class="stat-item"><span>📊</span> <span class="stat-value">${connections.length}</span> 总数</div>
      <div class="stat-item"><span>✓</span> <span class="stat-value stat-connected">${connectedIds.size}</span> 已连接</div>
    </div>
  </div>

  <div class="table-container">
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 150px;">名称</th>
          <th style="width: 120px;">类型</th>
          <th>连接信息</th>
          <th style="width: 100px;">状态</th>
          <th style="width: 250px;">操作</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const connections = ${JSON.stringify(connections)};
    const connectedIds = ${JSON.stringify(Array.from(connectedIds))};

    function addConnection() {
      vscode.postMessage({ command: 'add' });
    }

    function connect(event, id) {
      event.stopPropagation();
      vscode.postMessage({ command: 'connect', id: id });
    }

    function disconnect(event, id) {
      event.stopPropagation();
      vscode.postMessage({ command: 'disconnect', id: id });
    }

    function edit(event, id) {
      event.stopPropagation();
      vscode.postMessage({ command: 'edit', id: id });
    }

    function deleteQuery(event, id) {
      event.stopPropagation();
      if (confirm('确定要删除连接吗？')) {
        vscode.postMessage({ command: 'delete', id: id });
      }
    }

    function test(event, id) {
      event.stopPropagation();
      vscode.postMessage({ command: 'test', id: id });
    }

    function showToast(message) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = 'toast show';
      setTimeout(() => toast.classList.remove('show'), 2000);
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'added' || message.command === 'deleted') {
        location.reload();
      }
    });
  </script>
</body>
</html>
    `;
  }

  private dispose(): void {
    this._panel = undefined;
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }
}
