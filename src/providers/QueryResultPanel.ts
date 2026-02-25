/**
 * 查询结果提供者 - 使用 VSCode 底部面板
 * 参考 DataGrip 设计
 */

import * as vscode from 'vscode';
import type { QueryResult } from '../types';

export class QueryResultPanel {
  private static instance: QueryResultPanel;
  private outputChannel: vscode.OutputChannel;
  private resultView: vscode.WebviewPanel | undefined;
  private currentResult: QueryResult | null = null;

  private constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Berry DB - 查询结果');
  }

  public static getInstance(): QueryResultPanel {
    if (!QueryResultPanel.instance) {
      QueryResultPanel.instance = new QueryResultPanel();
    }
    return QueryResultPanel.instance;
  }

  /**
   * 显示查询结果
   */
  public showResult(result: QueryResult, query?: string): void {
    this.currentResult = result;

    // 创建或显示结果面板
    if (!this.resultView) {
      this.resultView = vscode.window.createWebviewPanel(
        'berryDbResult',
        '查询结果',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.file(__dirname)]
        }
      );

      this.resultView.onDidDispose(() => {
        this.resultView = undefined;
      });
    }

    this.resultView.title = result.success ? '查询结果' : '查询错误';
    this.resultView.webview.html = this.getHtmlContent(result, query);
    this.resultView.reveal(vscode.ViewColumn.Two);
  }

  /**
   * 显示错误
   */
  public showError(error: string, query?: string): void {
    const result: QueryResult = {
      columns: [],
      rows: [],
      rowCount: 0,
      duration: 0,
      success: false,
      error
    };
    this.showResult(result, query);
  }

  /**
   * 在输出频道显示简单结果
   */
  public showInOutput(message: string, type: 'info' | 'error' | 'success' = 'info'): void {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    this.outputChannel.appendLine(`[${timestamp}] ${prefix} ${message}`);
    this.outputChannel.show(true);
  }

  private getHtmlContent(result: QueryResult, query?: string): string {
    if (!result.success) {
      return this.getErrorHtml(result.error || '未知错误', query);
    }

    if (result.columns.length === 0) {
      return this.getInfoHtml(result, query);
    }

    return this.getTableHtml(result, query);
  }

  private getTableHtml(result: QueryResult, query?: string): string {
    const columns = result.columns.map(c => c.name);
    const rows = result.rows;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>查询结果</title>
  <style>
    :root {
      --bg-color: var(--vscode-editor-background);
      --text-color: var(--vscode-editor-foreground);
      --border-color: var(--vscode-widget-border);
      --header-bg: var(--vscode-editor-inactiveSelectionBackground);
      --row-hover: var(--vscode-list-hoverBackground);
      --row-selected: var(--vscode-editor-selectionBackground);
      --accent-color: #0e639c;
      --success-color: #4caf50;
      --null-color: #888;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: var(--vscode-font-family);
      color: var(--text-color);
      background: var(--bg-color);
      font-size: 13px;
      overflow: hidden;
    }

    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    /* 工具栏 */
    .toolbar {
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-color);
      align-items: center;
    }

    .btn {
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s;
    }

    .btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: transparent;
    }

    .stats {
      margin-left: auto;
      color: var(--null-color);
      font-size: 12px;
      display: flex;
      gap: 16px;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .stat-icon { color: var(--accent-color); }

    /* 查询预览 */
    .query-preview {
      padding: 8px 12px;
      background: rgba(14, 99, 156, 0.1);
      border-bottom: 1px solid var(--border-color);
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 12px;
      max-height: 80px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .query-label {
      color: var(--accent-color);
      font-weight: 600;
      margin-right: 8px;
    }

    /* 表格容器 */
    .table-container {
      flex: 1;
      overflow: auto;
      position: relative;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    thead {
      position: sticky;
      top: 0;
      z-index: 10;
    }

    th {
      background: var(--header-bg);
      border: 1px solid var(--border-color);
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      position: relative;
    }

    th:hover {
      background: var(--row-hover);
    }

    th.sorted-asc::after {
      content: ' ▲';
      color: var(--accent-color);
    }

    th.sorted-desc::after {
      content: ' ▼';
      color: var(--accent-color);
    }

    td {
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      white-space: nowrap;
      max-width: 500px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    tr:hover td {
      background: var(--row-hover);
    }

    tr.selected td {
      background: var(--row-selected);
    }

    .null {
      color: var(--null-color);
      font-style: italic;
    }

    .number { text-align: right; }
    .boolean { text-align: center; }

    /* 分页 */
    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-top: 1px solid var(--border-color);
      background: var(--bg-color);
    }

    .page-info {
      color: var(--null-color);
      font-size: 12px;
    }

    /* 空状态 */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--null-color);
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    /* 复制提示 */
    .copy-hint {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: var(--accent-color);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    }

    .copy-hint.show {
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="container">
    ${query ? `
    <div class="query-preview">
      <span class="query-label">SQL:</span>
      <span class="query-content">${escapeHtml(query)}</span>
    </div>
    ` : ''}

    <div class="toolbar">
      <button class="btn" onclick="exportCsv()">📥 CSV</button>
      <button class="btn" onclick="exportJson()">📋 JSON</button>
      <button class="btn btn-secondary" onclick="copyTable()">📄 复制表格</button>
      <button class="btn btn-secondary" onclick="copyAsInsert()">💾 复制为 INSERT</button>
      <div class="stats">
        <span class="stat-item">
          <span class="stat-icon">📊</span>
          <span id="rowCount">${result.rowCount}</span> 行
        </span>
        <span class="stat-item">
          <span class="stat-icon">📐</span>
          <span>${result.columns.length}</span> 列
        </span>
        <span class="stat-item">
          <span class="stat-icon">⏱️</span>
          <span>${result.duration}</span>ms
        </span>
        ${result.affectedRows !== undefined ? `
        <span class="stat-item">
          <span class="stat-icon">✓</span>
          <span>${result.affectedRows}</span> 影响
        </span>
        ` : ''}
      </div>
    </div>

    <div class="table-container">
      <table id="resultTable">
        <thead>
          <tr>
            ${columns.map((col, i) => `
              <th data-column="${i}" data-type="${result.columns[i].type}" onclick="sortTable(${i})">
                ${escapeHtml(col)}
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr onclick="selectRow(this)">
              ${columns.map(col => {
                const value = row[col];
                if (value === null || value === undefined) {
                  return `<td class="null">NULL</td>`;
                }
                const type = result.columns.find(c => c.name === col)?.type || '';
                const cellClass = type.toLowerCase().includes('int') || type.toLowerCase().includes('float') || type.toLowerCase().includes('double') || type.toLowerCase().includes('decimal') ? 'number' : type.toLowerCase().includes('bool') ? 'boolean' : '';
                return `<td class="${cellClass}">${escapeHtml(String(value))}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="pagination" id="pagination">
      <button class="btn btn-secondary" onclick="firstPage()">⏮ 首页</button>
      <button class="btn btn-secondary" onclick="prevPage()">◀ 上一页</button>
      <span class="page-info" id="pageInfo">第 1 / 1 页</span>
      <button class="btn btn-secondary" onclick="nextPage()">下一页 ▶</button>
      <button class="btn btn-secondary" onclick="lastPage()">末页 ⏭</button>
    </div>
  </div>

  <div class="copy-hint" id="copyHint">✅ 已复制到剪贴板</div>

  <script>
    const vscode = acquireVsCodeApi();
    const data = ${JSON.stringify(rows)};
    const columns = ${JSON.stringify(columns)};
    let currentPage = 1;
    const pageSize = 100;
    const totalPages = Math.ceil(data.length / pageSize) || 1;

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function sortTable(columnIndex) {
      // TODO: 实现排序
      vscode.postMessage({ command: 'sort', column: columnIndex });
    }

    function selectRow(row) {
      document.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
    }

    function exportCsv() {
      vscode.postMessage({ command: 'export', format: 'csv' });
    }

    function exportJson() {
      vscode.postMessage({ command: 'export', format: 'json' });
    }

    function copyTable() {
      const text = data.map(row => columns.map(col => row[col] || '').join('\\t')).join('\\n');
      navigator.clipboard.writeText(columns.join('\\t') + '\\n' + text);
      showCopyHint();
    }

    function copyAsInsert() {
      const tableName = 'table_name';
      const inserts = data.map(row => {
        const cols = columns.join(', ');
        const vals = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number' || typeof val === 'boolean') return String(val);
          return "'" + String(val).replace(/'/g, "''") + "'";
        }).join(', ');
        return \`INSERT INTO \${tableName} (\${cols}) VALUES (\${vals});\`;
      }).join('\\n');
      navigator.clipboard.writeText(inserts);
      showCopyHint();
    }

    function showCopyHint() {
      const hint = document.getElementById('copyHint');
      hint.classList.add('show');
      setTimeout(() => hint.classList.remove('show'), 2000);
    }

    function updatePageInfo() {
      document.getElementById('pageInfo').textContent = \`第 \${currentPage} / \${totalPages} 页\`;
    }

    function firstPage() { currentPage = 1; updatePageInfo(); }
    function prevPage() { if (currentPage > 1) currentPage--; updatePageInfo(); }
    function nextPage() { if (currentPage < totalPages) currentPage++; updatePageInfo(); }
    function lastPage() { currentPage = totalPages; updatePageInfo(); }

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

  private getInfoHtml(result: QueryResult, query?: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 20px;
    }
    .info-box {
      background: rgba(76, 175, 80, 0.1);
      border: 1px solid #4caf50;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .info-item {
      display: flex;
      gap: 8px;
      margin: 8px 0;
    }
    .info-label { font-weight: 600; color: #4caf50; }
    .query-preview {
      background: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 4px;
      font-family: monospace;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="info-box">
    <h3>✅ 查询执行成功</h3>
    ${query ? `<div class="query-preview">${escapeHtml(query)}</div>` : ''}
    <div class="info-item"><span class="info-label">影响行数:</span> ${result.affectedRows || 0}</div>
    <div class="info-item"><span class="info-label">执行时间:</span> ${result.duration}ms</div>
  </div>
</body>
</html>`;
  }

  private getErrorHtml(error: string, query?: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 20px;
    }
    .error-box {
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid #f44336;
      border-radius: 6px;
      padding: 16px;
    }
    .error-title {
      color: #f44336;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .error-message {
      font-family: monospace;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .query-preview {
      background: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 4px;
      font-family: monospace;
      margin-top: 12px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="error-box">
    <div class="error-title">❌ 查询执行失败</div>
    <div class="error-message">${escapeHtml(error)}</div>
    ${query ? `<div class="query-preview">${escapeHtml(query)}</div>` : ''}
  </div>
</body>
</html>`;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
