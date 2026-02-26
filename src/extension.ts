/**
 * Berry DB - VSCode 数据库客户端扩展
 * 入口文件
 */

import * as vscode from 'vscode';
import { ConnectionManager } from './services/ConnectionManager';
import { ConnectionProvider } from './providers/ConnectionProvider';
import { QueryHistoryProvider } from './providers/QueryHistoryProvider';
import { QueryHistoryService } from './services/QueryHistoryService';
import { SavedQueryService } from './services/SavedQueryService';
import { SqlSnippetService } from './services/SqlSnippetService';
import { QueryExecutorService } from './services/QueryExecutorService';
import { StatusBarManager } from './services/StatusBarManager';
import { DatabaseObjectCacheService } from './services/DatabaseObjectCacheService';
import { SqlLanguageProvider } from './services/SqlLanguageProvider';
import { QueryResultView } from './providers/QueryResultView';
import { CommandHandler } from './commands/CommandHandler';

let connectionManager: ConnectionManager;
let queryHistoryService: QueryHistoryService;
let savedQueryService: SavedQueryService;
let sqlSnippetService: SqlSnippetService;
let queryExecutorService: QueryExecutorService;
let statusBarManager: StatusBarManager;
let objectCacheService: DatabaseObjectCacheService;
let sqlLanguageProvider: SqlLanguageProvider;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _commandHandler: CommandHandler;

/**
 * 激活扩展
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('Berry DB 扩展已激活');

  try {
    // 初始化连接管理器
    connectionManager = await ConnectionManager.create(context);
    context.subscriptions.push(connectionManager);

    // 初始化查询历史服务
    queryHistoryService = new QueryHistoryService(context);
    context.subscriptions.push(queryHistoryService);

    // 初始化收藏查询服务
    savedQueryService = new SavedQueryService(context);
    context.subscriptions.push(savedQueryService);

    // 初始化 SQL 片段服务
    sqlSnippetService = new SqlSnippetService(context);
    context.subscriptions.push(sqlSnippetService);

    // 初始化查询执行器服务
    queryExecutorService = new QueryExecutorService(connectionManager);
    context.subscriptions.push(queryExecutorService);

    // 初始化数据库对象缓存服务
    objectCacheService = new DatabaseObjectCacheService(connectionManager);
    context.subscriptions.push(objectCacheService);

    // 初始化状态栏管理器
    statusBarManager = new StatusBarManager(connectionManager);
    context.subscriptions.push(statusBarManager);

    // 初始化 SQL 语言服务提供者（需要 statusBarManager 来获取活动连接）
    sqlLanguageProvider = new SqlLanguageProvider(objectCacheService, connectionManager, statusBarManager);
    context.subscriptions.push(sqlLanguageProvider);

    // 注册连接树提供者
    const connectionProvider = new ConnectionProvider(connectionManager);
    const treeView = vscode.window.registerTreeDataProvider('connections', connectionProvider);
    context.subscriptions.push(treeView);

    // 注册查询历史树提供者
    const historyProvider = new QueryHistoryProvider(queryHistoryService);
    const historyView = vscode.window.registerTreeDataProvider('queryHistory', historyProvider);
    context.subscriptions.push(historyView);

    // 注册命令处理器
    _commandHandler = new CommandHandler(
      context, 
      connectionManager, 
      queryHistoryService,
      savedQueryService,
      sqlSnippetService,
      queryExecutorService,
      statusBarManager,
      objectCacheService
    );

    // 注册 Webview 面板提供者
    registerWebviewPanels(context);

    // 监听配置变化
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('berry-db')) {
          connectionProvider.refresh();
          statusBarManager.updateStatusBar();
        }
      })
    );

    // 监听连接变化更新状态栏
    connectionManager.onDidChangeConnections(() => {
      statusBarManager.updateStatusBar();
    });

    // 设置上下文
    await vscode.commands.executeCommand('setContext', 'berry-db.hasConnections', true);

    // 注册状态栏点击命令
    context.subscriptions.push(
      vscode.commands.registerCommand('berry-db.statusBarClick', () => {
        statusBarManager.showConnectionDetails();
      })
    );

    console.log('Berry DB 扩展初始化完成');
  } catch (error) {
    console.error('Berry DB 扩展初始化失败:', error);
    vscode.window.showErrorMessage(`Berry DB 扩展初始化失败：${error}`);
  }
}

/**
 * 注册 Webview 面板
 */
function registerWebviewPanels(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(
      'berry-db.connectionForm',
      new ConnectionFormSerializer()
    )
  );

  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(
      'berry-db.queryResult',
      new QueryResultSerializer()
    )
  );

  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(
      'berry-db.tableEditor',
      new TableEditorSerializer()
    )
  );

  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(
      'berry-db.redisCli',
      new RedisCliSerializer()
    )
  );

  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(
      'berry-db.erDiagram',
      new ErDiagramSerializer()
    )
  );
}

/**
 * 停用扩展
 */
export async function deactivate() {
  console.log('Berry DB 扩展已停用');
  
  if (connectionManager) {
    await connectionManager.disconnectAll();
  }
}

/**
 * Webview 序列化器
 */
class ConnectionFormSerializer implements vscode.WebviewPanelSerializer {
  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
    webviewPanel.webview.html = getLoadingHtml();
  }
}

class QueryResultSerializer implements vscode.WebviewPanelSerializer {
  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
    webviewPanel.webview.html = getLoadingHtml();
  }
}

class TableEditorSerializer implements vscode.WebviewPanelSerializer {
  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
    webviewPanel.webview.html = getLoadingHtml();
  }
}

class RedisCliSerializer implements vscode.WebviewPanelSerializer {
  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
    webviewPanel.webview.html = getLoadingHtml();
  }
}

class ErDiagramSerializer implements vscode.WebviewPanelSerializer {
  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
    webviewPanel.webview.html = getLoadingHtml();
  }
}

/**
 * 加载中的 HTML
 */
function getLoadingHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
    }
    .loading {
      text-align: center;
    }
    .spinner {
      border: 2px solid var(--vscode-input-background);
      border-top-color: var(--vscode-focusBorder);
      border-radius: 50%;
      width: 24px;
      height: 24px;
      animation: spin 1s linear infinite;
      margin: 0 auto 10px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <div>加载中...</div>
  </div>
</body>
</html>`;
}
