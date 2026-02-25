/**
 * 连接配置 Webview 提供者
 */

import * as vscode from 'vscode';
import type { DatabaseConnection } from '../types';

export class ConnectionFormProvider {
  public static readonly viewType = 'berry-db.connectionForm';
  private _panel?: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _onDidSave?: (connection: DatabaseConnection) => void;
  private _editingConnection?: DatabaseConnection;

  constructor(private readonly extensionPath: string) {}

  public async show(connection?: DatabaseConnection): Promise<void> {
    this._editingConnection = connection;

    if (this._panel) {
      this._panel.reveal(vscode.ViewColumn.One);
      this.updateContent();
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      ConnectionFormProvider.viewType,
      connection ? '编辑连接' : '新建连接',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(this.extensionPath)],
        retainContextWhenHidden: true
      }
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'saveConnection':
            if (this._onDidSave) {
              this._onDidSave(message.connection);
            }
            break;
          case 'testConnection':
            this.testConnection(message.connection);
            break;
          case 'browseFile':
            this.browseFile();
            break;
          case 'cancel':
            this._panel?.dispose();
            break;
        }
      },
      undefined,
      this._disposables
    );
    this.updateContent();
  }

  public set onDidSave(callback: (connection: DatabaseConnection) => void) {
    this._onDidSave = callback;
  }

  private async testConnection(connection: DatabaseConnection): Promise<void> {
    try {
      // 创建临时服务进行测试
      const service: any = await this.createTestService(connection);
      if (!service) {
        throw new Error('不支持的数据库类型');
      }
      
      await service.connect();
      
      // 测试连接成功
      await service.disconnect();
      
      this._panel?.webview.postMessage({
        command: 'testResult',
        success: true,
        message: `✅ 连接成功！${connection.type.toUpperCase()} 数据库连接正常。`
      });
    } catch (error: any) {
      this._panel?.webview.postMessage({
        command: 'testResult',
        success: false,
        message: `❌ 连接失败：${error.message}`
      });
    }
  }

  private async createTestService(connection: DatabaseConnection): Promise<any> {
    // 动态导入数据库服务
    switch (connection.type) {
      case 'sqlite': {
        const { SqliteService } = await import('../services/database/SqliteService');
        return new SqliteService(connection);
      }
      case 'postgresql': {
        const { PostgresService } = await import('../services/database/PostgresService');
        return new PostgresService(connection);
      }
      case 'mysql': {
        const { MySqlService } = await import('../services/database/MySqlService');
        return new MySqlService(connection);
      }
      case 'redis': {
        const { RedisService } = await import('../services/database/RedisService');
        return new RedisService(connection);
      }
      default:
        return null;
    }
  }

  private async browseFile(): Promise<void> {
    const result = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'Database Files': ['db', 'sqlite', 'sqlite3']
      }
    });
    
    if (result && result[0]) {
      this._panel?.webview.postMessage({
        command: 'fileSelected',
        filePath: result[0].fsPath
      });
    }
  }

  private updateContent(): void {
    if (!this._panel) return;

    this._panel.title = this._editingConnection ? '编辑连接' : '新建连接';
    this._panel.webview.html = this.getHtmlContent();
    
    if (this._editingConnection) {
      setTimeout(() => {
        this._panel?.webview.postMessage({
          command: 'loadConnection',
          connection: this._editingConnection
        });
      }, 100);
    }
  }

  private getHtmlContent(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>连接配置</title>
  <style>
    :root {
      --primary-color: #0e639c;
      --primary-hover: #1177bb;
      --success-color: #4caf50;
      --error-color: #f44336;
      --bg-color: var(--vscode-editor-background);
      --card-bg: var(--vscode-input-background);
      --text-color: var(--vscode-foreground);
      --border-color: var(--vscode-widget-border);
      --input-bg: var(--vscode-input-background);
      --input-color: var(--vscode-input-foreground);
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: var(--vscode-font-family);
      color: var(--text-color);
      background: var(--bg-color);
      padding: 20px;
      font-size: 13px;
      line-height: 1.5;
    }

    .container { max-width: 700px; margin: 0 auto; }

    .header {
      text-align: center;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .header p {
      color: #888;
      font-size: 14px;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .card-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .card-title::before {
      content: '';
      width: 4px;
      height: 18px;
      background: var(--primary-color);
      border-radius: 2px;
    }

    .form-group { margin-bottom: 15px; }

    .form-group:last-child { margin-bottom: 0; }

    label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: var(--text-color);
    }

    .required::after {
      content: ' *';
      color: var(--error-color);
    }

    input, select, textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--input-bg);
      color: var(--input-color);
      font-size: 13px;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(14, 99, 156, 0.15);
    }

    input::placeholder { color: #888; }

    .row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
    }

    .row > .full { grid-column: 1 / -1; }

    .input-with-icon {
      position: relative;
      display: flex;
      gap: 8px;
    }

    .input-with-icon input { flex: 1; }

    .btn-icon {
      padding: 10px 16px;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      cursor: pointer;
      color: var(--text-color);
      transition: all 0.2s;
    }

    .btn-icon:hover {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: white;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 0;
    }

    .checkbox-group input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }

    .checkbox-group label {
      margin: 0;
      cursor: pointer;
    }

    .hidden { display: none; }

    .test-result {
      padding: 12px 16px;
      border-radius: 6px;
      margin-top: 15px;
      font-size: 13px;
      display: none;
    }

    .test-result.success {
      display: block;
      background: rgba(76, 175, 80, 0.1);
      color: var(--success-color);
      border: 1px solid var(--success-color);
    }

    .test-result.error {
      display: block;
      background: rgba(244, 67, 54, 0.1);
      color: var(--error-color);
      border: 1px solid var(--error-color);
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 25px;
      padding-top: 20px;
      border-top: 1px solid var(--border-color);
    }

    .btn {
      flex: 1;
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-primary {
      background: var(--primary-color);
      color: white;
    }

    .btn-primary:hover {
      background: var(--primary-hover);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(14, 99, 156, 0.3);
    }

    .btn-secondary {
      background: transparent;
      color: var(--text-color);
      border: 1px solid var(--border-color);
    }

    .btn-secondary:hover {
      background: var(--card-bg);
      border-color: var(--primary-color);
    }

    .btn-danger {
      background: var(--error-color);
      color: white;
    }

    .btn-danger:hover {
      background: #d32f2f;
    }

    .database-type-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }

    .database-type-option {
      position: relative;
    }

    .database-type-option input {
      position: absolute;
      opacity: 0;
      cursor: pointer;
    }

    .database-type-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
      background: var(--card-bg);
      border: 2px solid var(--border-color);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: center;
    }

    .database-type-card:hover {
      border-color: var(--primary-color);
      transform: translateY(-2px);
    }

    .database-type-option input:checked + .database-type-card {
      border-color: var(--primary-color);
      background: rgba(14, 99, 156, 0.1);
      box-shadow: 0 0 0 3px rgba(14, 99, 156, 0.15);
    }

    .database-type-icon {
      font-size: 28px;
      margin-bottom: 8px;
    }

    .database-type-name {
      font-weight: 500;
      font-size: 13px;
    }

    .help-text {
      font-size: 12px;
      color: #888;
      margin-top: 4px;
    }

    .section-divider {
      height: 1px;
      background: var(--border-color);
      margin: 20px 0;
    }

    .expandable {
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
    }

    .expandable-header {
      padding: 12px 16px;
      background: var(--card-bg);
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
    }

    .expandable-header:hover {
      background: rgba(14, 99, 156, 0.1);
    }

    .expandable-content {
      padding: 16px;
      border-top: 1px solid var(--border-color);
    }

    .expandable-icon {
      transition: transform 0.2s;
    }

    .expandable.open .expandable-icon {
      transform: rotate(180deg);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🗄️ 数据库连接配置</h1>
      <p>配置数据库连接信息</p>
    </div>

    <form id="connectionForm">
      <!-- 基本信息 -->
      <div class="card">
        <div class="card-title">基本信息</div>
        
        <div class="form-group">
          <label class="required">连接名称</label>
          <input type="text" id="name" name="name" required placeholder="例如：本地开发数据库">
        </div>

        <div class="form-group">
          <label class="required">数据库类型</label>
          <div class="database-type-grid">
            <label class="database-type-option">
              <input type="radio" name="type" value="sqlite" checked>
              <div class="database-type-card">
                <div class="database-type-icon">📄</div>
                <div class="database-type-name">SQLite</div>
              </div>
            </label>
            <label class="database-type-option">
              <input type="radio" name="type" value="postgresql">
              <div class="database-type-card">
                <div class="database-type-icon">🐘</div>
                <div class="database-type-name">PostgreSQL</div>
              </div>
            </label>
            <label class="database-type-option">
              <input type="radio" name="type" value="mysql">
              <div class="database-type-card">
                <div class="database-type-icon">🐬</div>
                <div class="database-type-name">MySQL</div>
              </div>
            </label>
            <label class="database-type-option">
              <input type="radio" name="type" value="redis">
              <div class="database-type-card">
                <div class="database-type-icon">🔴</div>
                <div class="database-type-name">Redis</div>
              </div>
            </label>
          </div>
        </div>

        <!-- SQLite 文件路径 -->
        <div class="form-group" id="filePathGroup">
          <label class="required">数据库文件路径</label>
          <div class="input-with-icon">
            <input type="text" id="filePath" name="filePath" placeholder="例如：C:\\data\\mydb.sqlite">
            <button type="button" class="btn-icon" id="browseBtn">浏览</button>
          </div>
          <div class="help-text">支持 .db, .sqlite, .sqlite3 格式</div>
        </div>

        <!-- 主机配置 -->
        <div id="hostConfig" class="hidden">
          <div class="row">
            <div class="form-group full">
              <label>主机地址</label>
              <input type="text" id="host" name="host" placeholder="localhost">
            </div>
          </div>
          <div class="row">
            <div class="form-group">
              <label>端口</label>
              <input type="number" id="port" name="port" placeholder="5432">
            </div>
            <div class="form-group">
              <label>数据库名</label>
              <input type="text" id="database" name="database" placeholder="postgres">
            </div>
          </div>
          <div class="row">
            <div class="form-group">
              <label>用户名</label>
              <input type="text" id="username" name="username" placeholder="postgres">
            </div>
            <div class="form-group">
              <label>密码</label>
              <input type="password" id="password" name="password" placeholder="••••••••">
            </div>
          </div>
        </div>
      </div>

      <!-- 高级选项 -->
      <div class="expandable" id="advancedSection">
        <div class="expandable-header" onclick="toggleExpandable('advancedSection')">
          <span>⚙️ 高级选项</span>
          <span class="expandable-icon">▼</span>
        </div>
        <div class="expandable-content">
          <div class="checkbox-group">
            <input type="checkbox" id="ssl" name="ssl">
            <label for="ssl">使用 SSL/TLS 加密连接</label>
          </div>
        </div>
      </div>

      <div class="section-divider"></div>

      <!-- SSH 隧道 -->
      <div class="expandable" id="sshSection">
        <div class="expandable-header" onclick="toggleExpandable('sshSection')">
          <span>🔐 SSH 隧道</span>
          <span class="expandable-icon">▼</span>
        </div>
        <div class="expandable-content">
          <div class="checkbox-group">
            <input type="checkbox" id="sshEnabled" name="sshEnabled">
            <label for="sshEnabled">启用 SSH 隧道</label>
          </div>
          <div id="sshConfig" class="hidden" style="margin-top: 15px;">
            <div class="row">
              <div class="form-group">
                <label>SSH 主机</label>
                <input type="text" id="sshHost" name="sshHost" placeholder="example.com">
              </div>
              <div class="form-group">
                <label>SSH 端口</label>
                <input type="number" id="sshPort" name="sshPort" value="22">
              </div>
            </div>
            <div class="row">
              <div class="form-group">
                <label>SSH 用户名</label>
                <input type="text" id="sshUsername" name="sshUsername" placeholder="root">
              </div>
              <div class="form-group">
                <label>SSH 密码/密钥</label>
                <input type="password" id="sshPassword" name="sshPassword">
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 测试结果 -->
      <div id="testResult" class="test-result"></div>

      <!-- 按钮 -->
      <div class="button-group">
        <button type="button" class="btn btn-secondary" id="testBtn">
          🔌 测试连接
        </button>
        <button type="button" class="btn btn-secondary" id="cancelBtn">
          取消
        </button>
        <button type="submit" class="btn btn-primary">
          💾 保存连接
        </button>
      </div>
    </form>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let editingConnection = null;

    // 监听来自扩展的消息
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'loadConnection') {
        editingConnection = message.connection;
        loadConnection(message.connection);
      } else if (message.command === 'testResult') {
        showTestResult(message.success, message.message);
      } else if (message.command === 'fileSelected') {
        document.getElementById('filePath').value = message.filePath;
      }
    });

    function loadConnection(conn) {
      document.getElementById('name').value = conn.name || '';
      document.querySelector('input[name="type"][value="' + conn.type + '"]').checked = true;
      document.getElementById('filePath').value = conn.filePath || '';
      document.getElementById('host').value = conn.host || '';
      document.getElementById('port').value = conn.port || '';
      document.getElementById('database').value = conn.database || '';
      document.getElementById('username').value = conn.username || '';
      document.getElementById('password').value = '';
      document.getElementById('ssl').checked = conn.ssl || false;
      
      if (conn.sshTunnel && conn.sshTunnel.enabled) {
        document.getElementById('sshEnabled').checked = true;
        document.getElementById('sshHost').value = conn.sshTunnel.host || '';
        document.getElementById('sshPort').value = conn.sshTunnel.port || 22;
        document.getElementById('sshUsername').value = conn.sshTunnel.username || '';
      }
      
      updateFormVisibility();
    }

    function updateFormVisibility() {
      const type = document.querySelector('input[name="type"]:checked').value;
      const filePathGroup = document.getElementById('filePathGroup');
      const hostConfig = document.getElementById('hostConfig');
      const sshConfig = document.getElementById('sshConfig');
      
      if (type === 'sqlite') {
        filePathGroup.classList.remove('hidden');
        hostConfig.classList.add('hidden');
      } else {
        filePathGroup.classList.add('hidden');
        hostConfig.classList.remove('hidden');
        
        const portInput = document.getElementById('port');
        const defaultPorts = { postgresql: 5432, mysql: 3306, redis: 6379 };
        if (!portInput.value) {
          portInput.value = defaultPorts[type] || '';
        }
      }

      sshConfig.classList.toggle('hidden', !document.getElementById('sshEnabled').checked);
    }

    function toggleExpandable(id) {
      const el = document.getElementById(id);
      el.classList.toggle('open');
    }

    function showTestResult(success, message) {
      const resultDiv = document.getElementById('testResult');
      resultDiv.textContent = message;
      resultDiv.className = 'test-result ' + (success ? 'success' : 'error');
    }

    // 事件监听
    document.querySelectorAll('input[name="type"]').forEach(radio => {
      radio.addEventListener('change', updateFormVisibility);
    });
    
    document.getElementById('sshEnabled').addEventListener('change', updateFormVisibility);

    document.getElementById('browseBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'browseFile' });
    });

    document.getElementById('testBtn').addEventListener('click', () => {
      const connection = getFormData();
      vscode.postMessage({ command: 'testConnection', connection });
    });

    document.getElementById('cancelBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'cancel' });
    });

    document.getElementById('connectionForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const connection = getFormData();
      vscode.postMessage({ command: 'saveConnection', connection });
    });

    function getFormData() {
      const type = document.querySelector('input[name="type"]:checked').value;
      return {
        id: editingConnection?.id || Date.now().toString(),
        name: document.getElementById('name').value,
        type: type,
        host: document.getElementById('host').value,
        port: parseInt(document.getElementById('port').value) || undefined,
        database: document.getElementById('database').value,
        username: document.getElementById('username').value,
        password: document.getElementById('password').value || undefined,
        filePath: document.getElementById('filePath').value || undefined,
        ssl: document.getElementById('ssl').checked,
        sshTunnel: document.getElementById('sshEnabled').checked ? {
          enabled: true,
          host: document.getElementById('sshHost').value,
          port: parseInt(document.getElementById('sshPort').value) || 22,
          username: document.getElementById('sshUsername').value,
          password: document.getElementById('sshPassword').value || undefined
        } : undefined
      };
    }

    // 初始化
    updateFormVisibility();
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
