/**
 * ER 图可视化 Webview
 */

import * as vscode from 'vscode';
import type { ERDiagram, TableDetail } from '../types';

export class ErDiagramProvider {
  public static readonly viewType = 'berry-db.erDiagram';
  private _panel?: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  constructor(private readonly extensionPath: string) {}

  public async show(
    connectionId: string,
    database: string | undefined,
    tables: Map<string, TableDetail>
  ): Promise<void> {
    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.Two);
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      ErDiagramProvider.viewType,
      'ER Diagram',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(this.extensionPath)],
        retainContextWhenHidden: true
      }
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this.getHtmlContent(connectionId, database, tables);
  }

  private getHtmlContent(
    connectionId: string,
    database: string | undefined,
    tables: Map<string, TableDetail>
  ): string {
    const tablesArray = Array.from(tables.entries()).map(([name, detail]) => ({
      name,
      columns: detail.columns,
      primaryKey: detail.columns.filter(c => c.isPrimaryKey).map(c => c.name)
    }));

    const relations = Array.from(tables.values()).flatMap(table =>
      table.foreignKeys.map(fk => ({
        fromTable: table.table.name,
        fromColumn: fk.columns[0],
        toTable: fk.referencedTable,
        toColumn: fk.referencedColumns[0],
        type: 'one-to-many' as const
      }))
    );

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ER Diagram</title>
  <style>
    :root {
      --vscode-foreground: #cccccc;
      --vscode-editor-background: #1e1e1e;
      --vscode-input-background: #3c3c3c;
      --vscode-button-background: #0e639c;
      --vscode-button-foreground: #ffffff;
      --vscode-table-border: #454545;
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
    .toolbar {
      display: flex;
      gap: 10px;
      padding: 8px;
      border-bottom: 1px solid var(--vscode-table-border);
      background: rgba(30, 30, 30, 0.95);
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
    .canvas-container {
      width: 100%;
      height: calc(100vh - 50px);
      overflow: auto;
      position: relative;
    }
    #canvas {
      min-width: 100%;
      min-height: 100%;
    }
    .table-node {
      position: absolute;
      background: #2d2d2d;
      border: 1px solid var(--vscode-table-border);
      border-radius: 6px;
      min-width: 200px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .table-header {
      background: linear-gradient(135deg, #0e639c 0%, #1a4a6e 100%);
      padding: 10px 12px;
      font-weight: 600;
      font-size: 13px;
      border-radius: 6px 6px 0 0;
      cursor: move;
      user-select: none;
    }
    .table-columns {
      padding: 8px 0;
    }
    .column {
      padding: 6px 12px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .column:last-child { border-bottom: none; }
    .column-name { flex: 1; }
    .column-type {
      color: #888;
      font-size: 11px;
    }
    .column-pk {
      color: #d7ba7d;
      font-weight: bold;
    }
    .column-fk {
      color: #569cd6;
    }
    svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .connection-line {
      stroke: #888;
      stroke-width: 2;
      fill: none;
    }
    .connection-arrow {
      fill: #888;
    }
    .legend {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(30, 30, 30, 0.9);
      border: 1px solid var(--vscode-table-border);
      border-radius: 6px;
      padding: 12px;
      font-size: 12px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 4px 0;
    }
    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="autoLayout()">📐 自动布局</button>
    <button onclick="zoomIn()">🔍 放大</button>
    <button onclick="zoomOut()">🔍 缩小</button>
    <button onclick="resetZoom()">100%</button>
    <button onclick="exportImage()">💾 导出图片</button>
  </div>
  
  <div class="canvas-container" id="canvasContainer">
    <svg id="connections"></svg>
    <div id="nodes"></div>
  </div>

  <div class="legend">
    <div class="legend-item">
      <div class="legend-color" style="background: #d7ba7d;"></div>
      <span>主键 (PK)</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: #569cd6;"></div>
      <span>外键 (FK)</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: #888;"></div>
      <span>关系</span>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const tables = ${JSON.stringify(tablesArray)};
    const relations = ${JSON.stringify(relations)};
    
    let scale = 1;
    let nodePositions = {};
    const nodeWidth = 220;
    const nodeGap = 50;

    function init() {
      renderNodes();
      renderConnections();
      autoLayout();
    }

    function renderNodes() {
      const container = document.getElementById('nodes');
      container.innerHTML = '';

      tables.forEach((table, index) => {
        const node = document.createElement('div');
        node.className = 'table-node';
        node.id = 'node-' + table.name;
        node.style.left = (100 + (index % 5) * (nodeWidth + nodeGap)) + 'px';
        node.style.top = (100 + Math.floor(index / 5) * 300) + 'px';
        
        const pkColumns = table.primaryKey || [];
        const fkColumns = [];
        
        node.innerHTML = \`
          <div class="table-header" onmousedown="startDrag(event, '\${table.name}')">
            📋 \${table.name}
          </div>
          <div class="table-columns">
            \${table.columns.map(col => {
              const isPk = pkColumns.includes(col.name);
              const isFk = fkColumns.includes(col.name);
              return \`
                <div class="column">
                  <span class="column-name">
                    \${isPk ? '<span class="column-pk">🔑</span>' : ''}
                    \${isFk ? '<span class="column-fk">🔗</span>' : ''}
                    \${col.name}
                  </span>
                  <span class="column-type">\${col.type}</span>
                </div>
              \`;
            }).join('')}
          </div>
        \`;
        
        container.appendChild(node);
        nodePositions[table.name] = {
          x: parseFloat(node.style.left),
          y: parseFloat(node.style.top)
        };
      });
    }

    function renderConnections() {
      const svg = document.getElementById('connections');
      svg.innerHTML = '';

      relations.forEach(rel => {
        const fromNode = nodePositions[rel.fromTable];
        const toNode = nodePositions[rel.toTable];
        
        if (!fromNode || !toNode) return;

        const x1 = fromNode.x + nodeWidth;
        const y1 = fromNode.y + 100;
        const x2 = toNode.x;
        const y2 = toNode.y + 100;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        const midX = (x1 + x2) / 2;
        const d = \`M \${x1} \${y1} C \${midX} \${y1}, \${midX} \${y2}, \${x2} \${y2}\`;
        
        path.setAttribute('d', d);
        path.setAttribute('class', 'connection-line');
        svg.appendChild(path);

        // 添加箭头
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('class', 'connection-arrow');
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const arrowSize = 10;
        const arrowX = x2 - 5;
        const arrowY = y2;
        arrow.setAttribute('points', \`
          \${arrowX},\${arrowY}
          \${arrowX - arrowSize * Math.cos(angle - Math.PI / 6)},\${arrowY - arrowSize * Math.sin(angle - Math.PI / 6)}
          \${arrowX - arrowSize * Math.cos(angle + Math.PI / 6)},\${arrowY - arrowSize * Math.sin(angle + Math.PI / 6)}
        \`);
        svg.appendChild(arrow);
      });
    }

    let draggedNode = null;
    let dragOffset = { x: 0, y: 0 };

    function startDrag(event, tableName) {
      draggedNode = tableName;
      const node = document.getElementById('node-' + tableName);
      const rect = node.getBoundingClientRect();
      dragOffset.x = event.clientX - rect.left;
      dragOffset.y = event.clientY - rect.top;
      
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', stopDrag);
    }

    function onDrag(event) {
      if (!draggedNode) return;
      
      const container = document.getElementById('canvasContainer');
      const rect = container.getBoundingClientRect();
      const node = document.getElementById('node-' + draggedNode);
      
      const x = event.clientX - rect.left - dragOffset.x;
      const y = event.clientY - rect.top - dragOffset.y;
      
      node.style.left = x + 'px';
      node.style.top = y + 'px';
      
      nodePositions[draggedNode] = { x, y };
      renderConnections();
    }

    function stopDrag() {
      draggedNode = null;
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', stopDrag);
    }

    function autoLayout() {
      // 简单的网格布局
      const cols = Math.ceil(Math.sqrt(tables.length));
      tables.forEach((table, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = 100 + col * (nodeWidth + nodeGap);
        const y = 100 + row * 300;
        
        const node = document.getElementById('node-' + table.name);
        if (node) {
          node.style.left = x + 'px';
          node.style.top = y + 'px';
          nodePositions[table.name] = { x, y };
        }
      });
      renderConnections();
    }

    function zoomIn() {
      scale *= 1.2;
      applyZoom();
    }

    function zoomOut() {
      scale /= 1.2;
      applyZoom();
    }

    function resetZoom() {
      scale = 1;
      applyZoom();
    }

    function applyZoom() {
      const container = document.getElementById('canvasContainer');
      container.style.transform = 'scale(' + scale + ')';
      container.style.transformOrigin = 'top left';
    }

    function exportImage() {
      vscode.postMessage({ command: 'export' });
    }

    // 初始化
    init();
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
