/**
 * 查询历史面板 - Datagrip 风格
 */

import * as vscode from 'vscode';
import { QueryHistoryService } from '../services/QueryHistoryService';

export class QueryHistoryPanelProvider {
  public static readonly viewType = 'berry-db.queryHistoryPanel';
  private _panel?: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionPath: string,
    private readonly historyService: QueryHistoryService
  ) {}

  public async show(): Promise<void> {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.One);
      this.refresh();
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      QueryHistoryPanelProvider.viewType,
      '查询历史',
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
      case 'rerun':
        this.rerunQuery(message.id);
        break;
      case 'delete':
        this.deleteQuery(message.id);
        break;
      case 'clear':
        this.clearHistory();
        break;
    }
  }

  private async rerunQuery(id: string): Promise<void> {
    const history = this.historyService.getAllHistory();
    const item = history.find(h => h.id === id);
    if (item) {
      await this.historyService.rerunQuery(item);
    }
  }

  private deleteQuery(id: string): void {
    this.historyService.deleteHistory(id);
    this.refresh();
  }

  private clearHistory(): void {
    this.historyService.clearHistory();
    this.refresh();
  }

  private getHtmlContent(): string {
    const history = this.historyService.getAllHistory();
    const total = history.length;
    const success = history.filter(h => h.success).length;
    const failed = total - success;
    const avgDuration = total > 0 ? Math.round(history.reduce((sum, h) => sum + h.duration, 0) / total) : 0;

    const formatDuration = (ms: number): string => {
      if (ms < 1000) return ms + 'ms';
      if (ms < 60000) return (ms / 1000).toFixed(2) + 's';
      return (ms / 60000).toFixed(2) + 'm';
    };

    let itemsHtml = '';
    if (history.length === 0) {
      itemsHtml = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">暂无查询历史</div>
          <div class="empty-message">执行 SQL 查询后，历史记录会自动显示在这里</div>
        </div>
      `;
    } else {
      itemsHtml = history.map(item => {
        const statusClass = item.success ? 'status-success' : 'status-failed';
        const statusText = item.success ? '✓ 成功' : '✗ 失败';
        const timestamp = new Date(item.timestamp).toLocaleString('zh-CN');
        const duration = formatDuration(item.duration);
        const escapeHtml = (text: string): string => {
          return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        };

        return `
        <div class="history-item" onclick="selectItem(this, '${item.id}')" data-id="${item.id}">
          <div class="item-header">
            <div class="item-meta">
              <span class="item-time">${timestamp}</span>
              <span class="item-duration">${duration}</span>
              <span class="item-status ${statusClass}">${statusText}</span>
            </div>
            <div class="item-actions">
              <button class="item-btn" onclick="rerun(event, '${item.id}')">运行</button>
              <button class="item-btn" onclick="copyQuery(event, '${item.id}')">复制</button>
              <button class="item-btn item-btn-danger" onclick="deleteQuery(event, '${item.id}')">删除</button>
            </div>
          </div>
          <div class="item-query">${escapeHtml(item.query)}</div>
        </div>
        `;
      }).join('');
    }

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>查询历史 - Berry DB</title>
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

    .header h2 {
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-stats {
      display: flex;
      gap: 20px;
      font-size: 12px;
    }

    .stat-item { display: flex; align-items: center; gap: 6px; }
    .stat-value { font-weight: 600; font-family: var(--font-mono); }
    .stat-success { color: var(--success-color); }
    .stat-failed { color: var(--error-color); }

    .toolbar {
      display: flex;
      gap: 8px;
      padding: 8px 16px;
      background: var(--bg-primary);
      border-bottom: 1px solid var(--border-color);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 3px;
      color: var(--text-primary);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn:hover { background: var(--accent-color); color: white; border-color: var(--accent-color); }
    .btn-primary { background: var(--accent-color); color: white; border-color: var(--accent-color); }
    .btn-danger { background: var(--error-color); color: white; border-color: var(--error-color); }

    .list-container {
      flex: 1;
      overflow: auto;
      background: var(--bg-primary);
    }

    .history-item {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
      transition: background 0.15s;
    }

    .history-item:hover { background: var(--bg-secondary); }
    .history-item.selected { border-left: 3px solid var(--accent-color); background: var(--bg-tertiary); }

    .item-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .item-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .item-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
    }

    .status-success { background: rgba(76, 175, 80, 0.1); color: var(--success-color); }
    .status-failed { background: rgba(244, 67, 54, 0.1); color: var(--error-color); }

    .item-actions { display: flex; gap: 6px; }
    .item-btn {
      padding: 4px 10px;
      font-size: 11px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 3px;
      cursor: pointer;
    }
    .item-btn:hover { background: var(--accent-color); color: white; border-color: var(--accent-color); }
    .item-btn-danger:hover { background: var(--error-color); }

    .item-query {
      font-family: var(--font-mono);
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 200px;
      overflow-y: auto;
      background: var(--bg-tertiary);
      padding: 10px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      line-height: 1.6;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-secondary);
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
    <h2>📊 查询历史 <span class="stat-value" style="margin-left:10px">${total}</span></h2>
    <div class="header-stats">
      <div class="stat-item"><span>✅</span><span class="stat-value stat-success">${success}</span></div>
      <div class="stat-item"><span>❌</span><span class="stat-value stat-failed">${failed}</span></div>
      <div class="stat-item"><span>⏱️</span><span class="stat-value">${formatDuration(avgDuration)}</span></div>
    </div>
  </div>

  <div class="toolbar">
    <button class="btn" onclick="refresh()">↻ 刷新</button>
    <button class="btn" onclick="exportJson()">📋 JSON</button>
    <button class="btn" onclick="exportCsv()">📥 CSV</button>
    <button class="btn btn-danger" onclick="clearAll()">🗑️ 清空</button>
  </div>

  <div class="list-container" id="historyList">${itemsHtml}</div>

  <div class="toast" id="toast"></div>

  <script>
    const vscode = acquireVsCodeApi();

    let selectedItem = null;

    function selectItem(element, id) {
      document.querySelectorAll('.history-item.selected').forEach(el => el.classList.remove('selected'));
      element.classList.add('selected');
      selectedItem = id;
    }

    function rerun(event, id) {
      event.stopPropagation();
      vscode.postMessage({ command: 'rerun', id: id });
      showToast('正在重新执行...');
    }

    function deleteQuery(event, id) {
      event.stopPropagation();
      if (confirm('确定要删除这条历史记录吗？')) {
        vscode.postMessage({ command: 'delete', id: id });
        showToast('已删除');
      }
    }

    function copyQuery(event, id) {
      event.stopPropagation();
      const history = ${JSON.stringify(history)};
      const item = history.find(h => h.id === id);
      if (item) {
        navigator.clipboard.writeText(item.query);
        showToast('已复制');
      }
    }

    function clearAll() {
      if (confirm('确定要清空所有查询历史吗？')) {
        vscode.postMessage({ command: 'clear' });
        showToast('历史已清空');
      }
    }

    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }

    function exportJson() {
      const data = JSON.stringify(${JSON.stringify(history)}, null, 2);
      navigator.clipboard.writeText(data);
      showToast('已复制 JSON 到剪贴板');
    }

    function exportCsv() {
      let csv = 'id,timestamp,connectionId,success,duration,error\\n';
      ${JSON.stringify(history)}.forEach(h => {
        csv += h.id + ',' + h.timestamp + ',,' + h.success + ',' + h.duration + ',\\n';
      });
      navigator.clipboard.writeText(csv);
      showToast('已复制 CSV 到剪贴板');
    }

    function showToast(message) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = 'toast show';
      setTimeout(() => toast.classList.remove('show'), 2000);
    }

    window.addEventListener('focus', () => {
      refresh();
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
