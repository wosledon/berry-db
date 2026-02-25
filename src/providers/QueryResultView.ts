/**
 * 查询结果面板 - DataGrip 风格
 * 显示在 VSCode 底部面板
 */

import * as vscode from 'vscode';
import type { QueryResult } from '../types';

export class QueryResultView {
  private static instance: QueryResultView;
  private panel: vscode.WebviewPanel | undefined;
  private currentResult: QueryResult | null = null;
  private currentQuery: string = '';

  private constructor() {}

  public static getInstance(): QueryResultView {
    if (!QueryResultView.instance) {
      QueryResultView.instance = new QueryResultView();
    }
    return QueryResultView.instance;
  }

  /**
   * 显示查询结果
   */
  public show(result: QueryResult, query?: string): void {
    this.currentResult = result;
    this.currentQuery = query || '';

    if (!this.panel) {
      this.createPanel();
    }

    this.panel.title = result.success ? '✅ 查询结果' : '❌ 查询错误';
    this.panel.webview.html = this.getHtmlContent(result, query);
    this.panel.reveal(vscode.ViewColumn.Two, true);
  }

  /**
   * 创建面板
   */
  private createPanel(): void {
    this.panel = vscode.window.createWebviewPanel(
      'berryDbQueryResult',
      '查询结果',
      { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(__dirname)]
      }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage((message) => {
      this.handleMessage(message);
    });
  }

  /**
   * 处理 Webview 消息
   */
  private handleMessage(message: any): void {
    switch (message.command) {
      case 'export':
        this.exportData(message.format);
        break;
      case 'copy':
        this.copyData(message.type);
        break;
    }
  }

  /**
   * 导出数据
   */
  private async exportData(format: string): Promise<void> {
    if (!this.currentResult || !this.currentResult.rows) {
      return;
    }

    const uri = await vscode.window.showSaveDialog({
      filters: {
        [format.toUpperCase()]: [format.toLowerCase()]
      }
    });

    if (!uri) return;

    // TODO: 实际导出逻辑
    vscode.window.showInformationMessage(`导出功能开发中... (${format})`);
  }

  /**
   * 复制数据
   */
  private async copyData(type: string): Promise<void> {
    if (!this.currentResult || !this.currentResult.rows) {
      return;
    }

    // TODO: 实际复制逻辑
    vscode.window.showInformationMessage(`复制功能开发中... (${type})`);
  }

  /**
   * 获取 HTML 内容 - DataGrip 风格
   */
  private getHtmlContent(result: QueryResult, query?: string): string {
    if (!result.success) {
      return this.getErrorHtml(result.error || '未知错误', query);
    }

    if (result.columns.length === 0) {
      return this.getInfoHtml(result, query);
    }

    return this.getDataGridHtml(result, query);
  }

  /**
   * DataGrip 风格数据网格
   */
  private getDataGridHtml(result: QueryResult, query?: string): string {
    const columns = result.columns.map(c => c.name);
    const rows = result.rows;
    const hasData = rows.length > 0;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>查询结果</title>
  <style>
    :root {
      --bg-primary: #1e1e1e;
      --bg-secondary: #252526;
      --bg-tertiary: #2d2d2d;
      --border-color: #3e3e42;
      --text-primary: #cccccc;
      --text-secondary: #858585;
      --accent-color: #0e639c;
      --accent-hover: #1177bb;
      --success-color: #4caf50;
      --error-color: #f44336;
      --warning-color: #ff9800;
      --info-color: #2196f3;
      --null-color: #6a9955;
      --row-hover: #2a2d2e;
      --row-selected: #094771;
      --header-bg: #2d2d2d;
      --font-family: 'Segoe UI', sans-serif;
      --font-mono: 'Consolas', 'Courier New', monospace;
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

    /* 主容器 */
    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    /* 工具栏 - DataGrip 风格 */
    .toolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
    }

    .toolbar-group {
      display: flex;
      gap: 2px;
      padding-right: 8px;
      margin-right: 8px;
      border-right: 1px solid var(--border-color);
    }

    .toolbar-group:last-child {
      border-right: none;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 3px;
      color: var(--text-primary);
      font-size: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn:hover {
      background: var(--bg-tertiary);
      border-color: var(--border-color);
    }

    .btn-primary {
      background: var(--accent-color);
      color: white;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
    }

    .btn-icon {
      padding: 4px 8px;
      font-size: 14px;
    }

    /* 状态栏 */
    .status-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 4px 12px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
      font-size: 12px;
      color: var(--text-secondary);
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-icon {
      color: var(--accent-color);
    }

    .status-success { color: var(--success-color); }
    .status-error { color: var(--error-color); }
    .status-warning { color: var(--warning-color); }

    /* 查询预览 */
    .query-section {
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
    }

    .query-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      cursor: pointer;
      user-select: none;
    }

    .query-header:hover {
      background: var(--bg-secondary);
    }

    .query-label {
      font-weight: 600;
      color: var(--accent-color);
      font-size: 12px;
    }

    .query-content {
      padding: 10px 12px;
      font-family: var(--font-mono);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--text-primary);
      background: var(--bg-primary);
      margin: 0 12px 12px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      max-height: 150px;
      overflow-y: auto;
    }

    /* 数据表格 - DataGrip 风格 */
    .data-grid-container {
      flex: 1;
      overflow: auto;
      background: var(--bg-primary);
    }

    .data-grid {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      font-family: var(--font-mono);
    }

    .data-grid thead {
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .data-grid th {
      background: var(--header-bg);
      border: 1px solid var(--border-color);
      border-bottom: 2px solid var(--accent-color);
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      color: var(--text-primary);
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      position: relative;
    }

    .data-grid th:hover {
      background: var(--bg-tertiary);
    }

    .data-grid th.sorted-asc::after {
      content: ' ▲';
      color: var(--accent-color);
    }

    .data-grid th.sorted-desc::after {
      content: ' ▼';
      color: var(--accent-color);
    }

    .data-grid td {
      border: 1px solid var(--border-color);
      padding: 6px 12px;
      white-space: nowrap;
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-primary);
    }

    .data-grid tr:hover td {
      background: var(--row-hover);
    }

    .data-grid tr.selected td {
      background: var(--row-selected);
    }

    .data-grid .row-number {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      text-align: right;
      width: 50px;
      font-size: 11px;
      user-select: none;
    }

    .data-grid .null {
      color: var(--null-color);
      font-style: italic;
    }

    .data-grid .number { text-align: right; }
    .data-grid .boolean { text-align: center; }

    /* 空状态 */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text-secondary);
    }

    .empty-icon {
      font-size: 64px;
      margin-bottom: 20px;
      opacity: 0.5;
    }

    .empty-title {
      font-size: 16px;
      margin-bottom: 8px;
    }

    .empty-message {
      font-size: 13px;
    }

    /* 错误显示 */
    .error-container {
      padding: 20px;
    }

    .error-box {
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid var(--error-color);
      border-radius: 6px;
      padding: 16px;
    }

    .error-title {
      color: var(--error-color);
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .error-message {
      font-family: var(--font-mono);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--text-primary);
    }

    /* 信息框 */
    .info-box {
      background: rgba(76, 175, 80, 0.1);
      border: 1px solid var(--success-color);
      border-radius: 6px;
      padding: 16px;
      margin: 20px;
    }

    .info-title {
      color: var(--success-color);
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .info-item {
      display: flex;
      gap: 16px;
      margin: 8px 0;
      font-size: 13px;
    }

    .info-label {
      color: var(--text-secondary);
    }

    .info-value {
      color: var(--text-primary);
      font-weight: 600;
    }

    /* 复制提示 */
    .toast {
      position: fixed;
      bottom: 60px;
      right: 20px;
      background: var(--accent-color);
      color: white;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 13px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s;
    }

    .toast.show {
      transform: translateY(0);
      opacity: 1;
    }

    /* 滚动条 */
    ::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }

    ::-webkit-scrollbar-track {
      background: var(--bg-primary);
    }

    ::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 5px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-secondary);
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-group">
        <button class="btn btn-primary" onclick="refresh()" title="刷新">
          ↻ 刷新
        </button>
      </div>
      <div class="toolbar-group">
        <button class="btn" onclick="copyHeaders()" title="复制表头">
          📋 表头
        </button>
        <button class="btn" onclick="copyRows()" title="复制行">
          📄 行
        </button>
        <button class="btn" onclick="copyAll()" title="复制全部">
          📑 全部
        </button>
      </div>
      <div class="toolbar-group">
        <button class="btn" onclick="exportCsv()" title="导出 CSV">
          📥 CSV
        </button>
        <button class="btn" onclick="exportJson()" title="导出 JSON">
          📋 JSON
        </button>
        <button class="btn" onclick="exportInsert()" title="导出 INSERT">
          💾 INSERT
        </button>
      </div>
      <div class="toolbar-group">
        <button class="btn" onclick="toggleNulls()" title="显示 NULL">
          ∅ NULL
        </button>
      </div>
    </div>

    <!-- 查询预览 -->
    ${query ? `
    <div class="query-section">
      <div class="query-header" onclick="toggleQuery()">
        <span class="query-label">📝 SQL 查询</span>
        <span>▼</span>
      </div>
      <div class="query-content" id="queryContent">${escapeHtml(query)}</div>
    </div>
    ` : ''}

    <!-- 数据表格 -->
    <div class="data-grid-container">
      <table class="data-grid">
        <thead>
          <tr>
            <th class="row-number">#</th>
            ${columns.map((col, i) => `
              <th data-column="${i}" onclick="sortTable(${i})">
                ${escapeHtml(col)}
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${hasData ? rows.map((row, rowIndex) => `
            <tr onclick="selectRow(this)" data-index="${rowIndex}">
              <td class="row-number">${rowIndex + 1}</td>
              ${columns.map(col => {
                const value = row[col];
                if (value === null || value === undefined) {
                  return `<td class="null">NULL</td>`;
                }
                const type = result.columns.find(c => c.name === col)?.type || '';
                const cellClass = isNumericType(type) ? 'number' : isBooleanType(type) ? 'boolean' : '';
                return `<td class="${cellClass}">${escapeHtml(String(value))}</td>`;
              }).join('')}
            </tr>
          `).join('') : `
            <tr>
              <td colspan="${columns.length + 1}" style="text-align: center; padding: 40px;">
                <div class="empty-state">
                  <div class="empty-icon">📊</div>
                  <div class="empty-title">无数据</div>
                  <div class="empty-message">查询执行成功，但没有返回结果</div>
                </div>
              </td>
            </tr>
          `}
        </tbody>
      </table>
    </div>

    <!-- 状态栏 -->
    <div class="status-bar">
      <span class="status-item status-success">
        <span class="status-icon">✓</span>
        查询成功
      </span>
      <span class="status-item">
        <span class="status-icon">📊</span>
        <span id="rowCount">${result.rowCount}</span> 行
      </span>
      <span class="status-item">
        <span class="status-icon">📐</span>
        <span>${result.columns.length}</span> 列
      </span>
      <span class="status-item">
        <span class="status-icon">⏱️</span>
        <span>${result.duration}</span>ms
      </span>
      ${result.affectedRows !== undefined ? `
      <span class="status-item">
        <span class="status-icon">✓</span>
        <span>${result.affectedRows}</span> 影响
      </span>
      ` : ''}
    </div>
  </div>

  <div class="toast" id="toast">✅ 已复制到剪贴板</div>

  <script>
    const vscode = acquireVsCodeApi();
    const data = ${JSON.stringify(rows)};
    const columns = ${JSON.stringify(columns)};

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function isNumericType(type) {
      const t = (type || '').toLowerCase();
      return t.includes('int') || t.includes('float') || t.includes('double') || t.includes('decimal') || t.includes('number');
    }

    function isBooleanType(type) {
      return (type || '').toLowerCase().includes('bool');
    }

    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }

    function toggleQuery() {
      const content = document.getElementById('queryContent');
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
    }

    function toggleNulls() {
      document.querySelectorAll('.null').forEach(el => {
        el.style.fontStyle = el.style.fontStyle === 'italic' ? 'normal' : 'italic';
        el.style.opacity = el.style.opacity === '0.5' ? '1' : '0.5';
      });
    }

    function selectRow(row) {
      document.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
    }

    function sortTable(columnIndex) {
      // TODO: 实现排序
      showToast('排序功能开发中...');
    }

    function copyHeaders() {
      navigator.clipboard.writeText(columns.join('\\t'));
      showToast('✅ 表头已复制');
    }

    function copyRows() {
      const text = data.map(row => columns.map(col => row[col] ?? 'NULL').join('\\t')).join('\\n');
      navigator.clipboard.writeText(text);
      showToast('✅ 行已复制');
    }

    function copyAll() {
      const header = columns.join('\\t');
      const rows = data.map(row => columns.map(col => row[col] ?? 'NULL').join('\\t')).join('\\n');
      navigator.clipboard.writeText(header + '\\n' + rows);
      showToast('✅ 全部已复制');
    }

    function exportCsv() {
      vscode.postMessage({ command: 'export', format: 'csv' });
    }

    function exportJson() {
      vscode.postMessage({ command: 'export', format: 'json' });
    }

    function exportInsert() {
      vscode.postMessage({ command: 'export', format: 'insert' });
    }

    function showToast(message) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'refresh') {
        location.reload();
      }
    });
  </script>
</body>
</html>`;
  }

  /**
   * 错误页面
   */
  private getErrorHtml(error: string, query?: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    :root {
      --bg-primary: #1e1e1e;
      --text-primary: #cccccc;
      --text-secondary: #858585;
      --error-color: #f44336;
      --border-color: #3e3e42;
      --font-mono: 'Consolas', 'Courier New', monospace;
    }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      padding: 20px;
    }
    .error-box {
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid var(--error-color);
      border-radius: 6px;
      padding: 20px;
    }
    .error-title {
      color: var(--error-color);
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .error-message {
      font-family: var(--font-mono);
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-all;
      line-height: 1.6;
    }
    .query-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--border-color);
    }
    .query-label {
      color: var(--text-secondary);
      font-size: 12px;
      margin-bottom: 8px;
    }
    .query-content {
      font-family: var(--font-mono);
      font-size: 12px;
      background: var(--bg-primary);
      padding: 12px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="error-box">
    <div class="error-title">❌ 查询执行失败</div>
    <div class="error-message">${escapeHtml(error)}</div>
    ${query ? `
    <div class="query-section">
      <div class="query-label">执行的 SQL:</div>
      <div class="query-content">${escapeHtml(query)}</div>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
  }

  /**
   * 信息页面（无结果集）
   */
  private getInfoHtml(result: QueryResult, query?: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    :root {
      --bg-primary: #1e1e1e;
      --text-primary: #cccccc;
      --text-secondary: #858585;
      --success-color: #4caf50;
      --border-color: #3e3e42;
    }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      padding: 20px;
    }
    .info-box {
      background: rgba(76, 175, 80, 0.1);
      border: 1px solid var(--success-color);
      border-radius: 6px;
      padding: 20px;
    }
    .info-title {
      color: var(--success-color);
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .info-item {
      display: flex;
      gap: 16px;
      margin: 10px 0;
      font-size: 14px;
    }
    .info-label {
      color: var(--text-secondary);
    }
    .info-value {
      color: var(--text-primary);
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="info-box">
    <div class="info-title">✅ 查询执行成功</div>
    <div class="info-item">
      <span class="info-label">影响行数:</span>
      <span class="info-value">${result.affectedRows || 0}</span>
    </div>
    <div class="info-item">
      <span class="info-label">执行时间:</span>
      <span class="info-value">${result.duration}ms</span>
    </div>
  </div>
</body>
</html>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isNumericType(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes('int') || t.includes('float') || t.includes('double') || t.includes('decimal');
}

function isBooleanType(type: string): boolean {
  return type.toLowerCase().includes('bool');
}
