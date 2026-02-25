/**
 * 表结构编辑器 Webview
 */

import * as vscode from 'vscode';
import type { TableDetail, ColumnInfo } from '../types';

export class TableEditorProvider {
  public static readonly viewType = 'berry-db.tableEditor';
  private _panel?: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  constructor(private readonly extensionPath: string) {}

  public async show(
    connectionId: string,
    database: string | undefined,
    table: string,
    tableDetail?: TableDetail
  ): Promise<void> {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.One);
      this.updateContent(connectionId, database, table, tableDetail);
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      TableEditorProvider.viewType,
      `表结构：${table}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(this.extensionPath)],
        retainContextWhenHidden: true
      }
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this.updateContent(connectionId, database, table, tableDetail);
  }

  private updateContent(
    connectionId: string,
    database: string | undefined,
    table: string,
    tableDetail?: TableDetail
  ): void {
    if (!this._panel) return;

    this._panel.title = `表结构：${table}`;
    this._panel.webview.html = this.getHtmlContent(connectionId, database, table, tableDetail);
  }

  private getHtmlContent(
    connectionId: string,
    database: string | undefined,
    table: string,
    tableDetail?: TableDetail
  ): string {
    const columns = tableDetail?.columns || [];
    const indexes = tableDetail?.indexes || [];
    const foreignKeys = tableDetail?.foreignKeys || [];

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>表结构编辑器</title>
  <style>
    :root {
      --vscode-foreground: #cccccc;
      --vscode-editor-background: #1e1e1e;
      --vscode-input-background: #3c3c3c;
      --vscode-button-background: #0e639c;
      --vscode-button-foreground: #ffffff;
      --vscode-table-border: #454545;
      --vscode-table-headerBackground: #2d2d2d;
    }
    * { box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h2 { margin-top: 0; border-bottom: 1px solid var(--vscode-table-border); padding-bottom: 10px; }
    h3 { margin-top: 20px; font-size: 14px; color: #888; }
    
    .toolbar { margin-bottom: 15px; }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 2px;
      cursor: pointer;
      margin-right: 10px;
    }
    button:hover { opacity: 0.9; }
    button.secondary {
      background: transparent;
      border: 1px solid var(--vscode-foreground);
    }
    button.danger {
      background: #c72e2e;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid var(--vscode-table-border);
      padding: 8px;
      text-align: left;
    }
    th {
      background: var(--vscode-table-headerBackground);
      font-weight: 600;
    }
    tr:hover { background: rgba(255,255,255,0.05); }
    
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      margin-right: 4px;
    }
    .badge-pk { background: #d7ba7d; color: #1e1e1e; }
    .badge-nn { background: #569cd6; color: #fff; }
    .badge-ai { background: #4ec9b0; color: #1e1e1e; }
    .badge-uni { background: #ce9178; color: #1e1e1e; }

    .empty { color: #888; font-style: italic; padding: 20px; text-align: center; }
    
    .tab-container { display: flex; border-bottom: 1px solid var(--vscode-table-border); margin-bottom: 15px; }
    .tab {
      padding: 8px 16px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
    }
    .tab:hover { background: rgba(255,255,255,0.05); }
    .tab.active {
      border-bottom-color: var(--vscode-button-background);
      color: var(--vscode-button-background);
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    .form-row { display: flex; gap: 10px; margin-bottom: 10px; }
    .form-group { flex: 1; }
    label { display: block; margin-bottom: 4px; font-size: 12px; color: #888; }
    input, select {
      width: 100%;
      padding: 6px;
      background: var(--vscode-input-background);
      border: 1px solid transparent;
      color: var(--vscode-foreground);
      border-radius: 2px;
    }
    input:focus, select:focus {
      outline: none;
      border-color: var(--vscode-button-background);
    }
    .checkbox-group {
      display: flex;
      gap: 15px;
      margin-top: 10px;
    }
    .checkbox-group label {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
    }
    .checkbox-group input { width: auto; }
  </style>
</head>
<body>
  <div class="container">
    <div class="toolbar">
      <button id="addColumn">➕ 添加列</button>
      <button id="saveChanges" class="secondary">💾 保存更改</button>
      <button id="refresh" class="secondary">🔄 刷新</button>
      <button id="deleteTable" class="danger" style="float: right;">🗑️ 删除表</button>
    </div>

    <div class="tab-container">
      <div class="tab active" data-tab="columns">列</div>
      <div class="tab" data-tab="indexes">索引</div>
      <div class="tab" data-tab="foreignKeys">外键</div>
      <div class="tab" data-tab="preview">SQL 预览</div>
    </div>

    <div class="tab-content active" id="columns-tab">
      <h3>列定义</h3>
      <table id="columnsTable">
        <thead>
          <tr>
            <th>列名</th>
            <th>数据类型</th>
            <th>长度</th>
            <th>默认值</th>
            <th>注释</th>
            <th>属性</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${columns.length > 0 ? columns.map(col => `
            <tr data-column="${col.name}">
              <td>${escapeHtml(col.name)}</td>
              <td>${escapeHtml(col.type)}</td>
              <td>-</td>
              <td>${col.defaultValue ? escapeHtml(String(col.defaultValue)) : '-'}</td>
              <td>${col.comment ? escapeHtml(col.comment) : '-'}</td>
              <td>
                ${col.isPrimaryKey ? '<span class="badge badge-pk">PK</span>' : ''}
                ${!col.nullable ? '<span class="badge badge-nn">NN</span>' : ''}
                ${col.isAutoIncrement ? '<span class="badge badge-ai">AI</span>' : ''}
                ${col.isUnique ? '<span class="badge badge-uni">UQ</span>' : ''}
              </td>
              <td>
                <button class="secondary" onclick="editColumn('${escapeHtml(col.name)}')">编辑</button>
                <button class="danger" onclick="deleteColumn('${escapeHtml(col.name)}')">删除</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="7" class="empty">暂无列</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="tab-content" id="indexes-tab">
      <h3>索引</h3>
      <table id="indexesTable">
        <thead>
          <tr>
            <th>索引名</th>
            <th>列</th>
            <th>类型</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${indexes.length > 0 ? indexes.map(idx => `
            <tr>
              <td>${escapeHtml(idx.name)}</td>
              <td>${idx.columns.map(c => escapeHtml(c)).join(', ')}</td>
              <td>
                ${idx.isPrimary ? '<span class="badge badge-pk">PRIMARY</span>' : ''}
                ${idx.isUnique ? '<span class="badge badge-uni">UNIQUE</span>' : ''}
              </td>
              <td>
                <button class="danger" onclick="deleteIndex('${escapeHtml(idx.name)}')">删除</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="4" class="empty">暂无索引</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="tab-content" id="foreignKeys-tab">
      <h3>外键约束</h3>
      <table id="foreignKeysTable">
        <thead>
          <tr>
            <th>约束名</th>
            <th>列</th>
            <th>引用表</th>
            <th>引用列</th>
            <th>ON DELETE</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${foreignKeys.length > 0 ? foreignKeys.map(fk => `
            <tr>
              <td>${escapeHtml(fk.name)}</td>
              <td>${fk.columns.map(c => escapeHtml(c)).join(', ')}</td>
              <td>${escapeHtml(fk.referencedTable)}</td>
              <td>${fk.referencedColumns.map(c => escapeHtml(c)).join(', ')}</td>
              <td>${escapeHtml(fk.onDelete)}</td>
              <td>
                <button class="danger" onclick="deleteForeignKey('${escapeHtml(fk.name)}')">删除</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="6" class="empty">暂无外键</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="tab-content" id="preview-tab">
      <h3>CREATE TABLE 语句</h3>
      <pre id="sqlPreview" style="background: var(--vscode-input-background); padding: 15px; border-radius: 4px; overflow-x: auto;">${generateCreateTableSQL(table, columns)}</pre>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const connectionId = '${connectionId}';
    const database = '${database || ''}';
    const tableName = '${table}';

    // Tab 切换
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
      });
    });

    // 添加列
    document.getElementById('addColumn').addEventListener('click', () => {
      vscode.postMessage({ command: 'addColumn' });
    });

    // 保存更改
    document.getElementById('saveChanges').addEventListener('click', () => {
      vscode.postMessage({ command: 'saveChanges' });
    });

    // 刷新
    document.getElementById('refresh').addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh' });
    });

    // 删除表
    document.getElementById('deleteTable').addEventListener('click', () => {
      if (confirm('确定要删除表 "' + tableName + '" 吗？此操作不可逆！')) {
        vscode.postMessage({ command: 'deleteTable', table: tableName });
      }
    });

    function editColumn(columnName) {
      vscode.postMessage({ command: 'editColumn', column: columnName });
    }

    function deleteColumn(columnName) {
      if (confirm('确定要删除列 "' + columnName + '" 吗？')) {
        vscode.postMessage({ command: 'deleteColumn', column: columnName });
      }
    }

    function deleteIndex(indexName) {
      if (confirm('确定要删除索引 "' + indexName + '" 吗？')) {
        vscode.postMessage({ command: 'deleteIndex', index: indexName });
      }
    }

    function deleteForeignKey(fkName) {
      if (confirm('确定要删除外键 "' + fkName + '" 吗？')) {
        vscode.postMessage({ command: 'deleteForeignKey', fk: fkName });
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
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

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generateCreateTableSQL(tableName: string, columns: ColumnInfo[]): string {
  if (!columns || columns.length === 0) return '-- 暂无列定义';
  
  const columnDefs = columns.map(col => {
    let def = `  \`${col.name}\` ${col.type}`;
    if (col.isPrimaryKey) def += ' PRIMARY KEY';
    if (col.isAutoIncrement) def += ' AUTO_INCREMENT';
    if (!col.nullable && !col.isPrimaryKey) def += ' NOT NULL';
    if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
    return def;
  });
  
  return `CREATE TABLE \`${tableName}\` (\n${columnDefs.join(',\n')}\n);`;
}
