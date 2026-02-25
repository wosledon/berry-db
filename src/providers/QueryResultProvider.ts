/**
 * 查询结果 Webview 提供者
 */

import * as vscode from 'vscode';
import { QueryResult } from '../types';

export class QueryResultProvider {
  public static readonly viewType = 'berry-db.queryResult';
  private _panel?: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  constructor(private readonly extensionPath: string) {}

  public show(): vscode.WebviewPanel {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.Two);
      return this._panel;
    }

    this._panel = vscode.window.createWebviewPanel(
      QueryResultProvider.viewType,
      '查询结果',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(this.extensionPath)],
        retainContextWhenHidden: true
      }
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this.getHtmlContent();

    return this._panel;
  }

  public async showQueryResult(result: QueryResult, query?: string): Promise<void> {
    const panel = this.show();
    
    panel.title = result.success ? '查询结果' : '查询错误';
    
    // 发送数据到 webview
    panel.webview.postMessage({
      command: 'showResult',
      result,
      query
    });
  }

  public showError(message: string): void {
    const panel = this.show();
    panel.title = '查询错误';
    
    panel.webview.postMessage({
      command: 'showError',
      message
    });
  }

  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>查询结果</title>
  <style>
    :root {
      --vscode-foreground: #cccccc;
      --vscode-editor-background: #1e1e1e;
      --vscode-list-hoverBackground: #2a2d2e;
      --vscode-list-activeSelectionBackground: #094771;
      --vscode-table-headerBackground: #2d2d2d;
      --vscode-table-border: #454545;
      --vscode-button-background: #0e639c;
      --vscode-button-foreground: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .toolbar {
      display: flex;
      gap: 10px;
      padding: 8px;
      border-bottom: 1px solid var(--vscode-table-border);
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
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .stats {
      font-size: 12px;
      color: #888;
      margin-left: auto;
    }
    .result-container {
      flex: 1;
      overflow: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      border: 1px solid var(--vscode-table-border);
      padding: 6px 8px;
      text-align: left;
      white-space: nowrap;
    }
    th {
      background: var(--vscode-table-headerBackground);
      position: sticky;
      top: 0;
      font-weight: 600;
      cursor: pointer;
      user-select: none;
    }
    th:hover { background: #3d3d3d; }
    tr:nth-child(even) { background: rgba(255,255,255,0.02); }
    tr:hover { background: var(--vscode-list-hoverBackground); }
    .null { color: #888; font-style: italic; }
    .error-message {
      padding: 20px;
      color: #f44336;
    }
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
      color: #888;
    }
    .query-preview {
      padding: 8px;
      border-bottom: 1px solid var(--vscode-table-border);
      font-family: monospace;
      font-size: 11px;
      background: rgba(0,0,0,0.2);
      max-height: 100px;
      overflow: auto;
    }
    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      padding: 8px;
      border-top: 1px solid var(--vscode-table-border);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="query-preview" id="queryPreview" style="display:none;"></div>
    <div class="toolbar">
      <button id="exportCsv">导出 CSV</button>
      <button id="exportJson">导出 JSON</button>
      <button id="copyData">复制数据</button>
      <span class="stats" id="stats"></span>
    </div>
    <div class="result-container">
      <div id="content">
        <div class="loading">等待查询...</div>
      </div>
    </div>
    <div class="pagination" id="pagination" style="display:none;">
      <button id="prevPage">上一页</button>
      <span id="pageInfo"></span>
      <button id="nextPage">下一页</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentResult = null;
    let currentPage = 1;
    const pageSize = 100;

    window.addEventListener('message', event => {
      const message = event.data;
      
      if (message.command === 'showResult') {
        currentResult = message.result;
        currentPage = 1;
        
        if (message.query) {
          document.getElementById('queryPreview').textContent = message.query;
          document.getElementById('queryPreview').style.display = 'block';
        }
        
        if (message.result.success) {
          renderTable(message.result);
        } else {
          renderError(message.result.error || '查询失败');
        }
      }
      
      if (message.command === 'showError') {
        renderError(message.message);
      }
    });

    function renderTable(result) {
      const container = document.getElementById('content');
      const stats = document.getElementById('stats');
      
      if (!result.columns || result.columns.length === 0) {
        container.innerHTML = '<div class="loading">查询执行成功，无结果集</div>';
        stats.textContent = \`影响行数：\${result.affectedRows || 0}, 耗时：\${result.duration}ms\`;
        return;
      }

      const totalPages = Math.ceil(result.rows.length / pageSize);
      
      stats.textContent = \`\${result.rowCount} 行 | \${result.columns.length} 列 | 耗时：\${result.duration}ms\`;
      
      renderPage(result, 1);
      
      if (totalPages > 1) {
        document.getElementById('pagination').style.display = 'flex';
        document.getElementById('pageInfo').textContent = \`第 1 / \${totalPages} 页\`;
      }
    }

    function renderPage(result, page) {
      const container = document.getElementById('content');
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const pageRows = result.rows.slice(start, end);
      
      let html = '<table><thead><tr>';
      result.columns.forEach(col => {
        html += \`<th data-column="\${col.name}">\${escapeHtml(col.name)}</th>\`;
      });
      html += '</tr></thead><tbody>';
      
      pageRows.forEach(row => {
        html += '<tr>';
        result.columns.forEach(col => {
          const value = row[col.name];
          if (value === null || value === undefined) {
            html += '<td class="null">NULL</td>';
          } else {
            html += \`<td>\${escapeHtml(String(value))}</td>\`;
          }
        });
        html += '</tr>';
      });
      
      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function renderError(message) {
      const container = document.getElementById('content');
      const stats = document.getElementById('stats');
      
      container.innerHTML = \`<div class="error-message">❌ \${escapeHtml(message)}</div>\`;
      stats.textContent = '';
      document.getElementById('pagination').style.display = 'none';
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // 导出 CSV
    document.getElementById('exportCsv').addEventListener('click', () => {
      if (!currentResult || !currentResult.rows) return;
      vscode.postMessage({ command: 'export', format: 'csv' });
    });

    // 导出 JSON
    document.getElementById('exportJson').addEventListener('click', () => {
      if (!currentResult || !currentResult.rows) return;
      vscode.postMessage({ command: 'export', format: 'json' });
    });

    // 复制数据
    document.getElementById('copyData').addEventListener('click', () => {
      if (!currentResult || !currentResult.rows) return;
      vscode.postMessage({ command: 'copy' });
    });

    // 分页
    document.getElementById('prevPage').addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderPage(currentResult, currentPage);
        const totalPages = Math.ceil(currentResult.rows.length / pageSize);
        document.getElementById('pageInfo').textContent = \`第 \${currentPage} / \${totalPages} 页\`;
      }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
      const totalPages = Math.ceil(currentResult.rows.length / pageSize);
      if (currentPage < totalPages) {
        currentPage++;
        renderPage(currentResult, currentPage);
        document.getElementById('pageInfo').textContent = \`第 \${currentPage} / \${totalPages} 页\`;
      }
    });
  </script>
</body>
</html>`;
  }

  private dispose(): void {
    this._panel = undefined;
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }
}
