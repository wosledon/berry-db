/**
 * 命令处理器
 * 处理所有 Berry DB 相关的命令
 */

import * as vscode from 'vscode';
import { ConnectionManager } from '../services/ConnectionManager';
import { ConnectionFormProvider } from '../webviews/ConnectionForm';
import { QueryResultView } from '../providers/QueryResultView';
import { TableEditorProvider } from '../webviews/TableEditor';
import { RedisCliProvider } from '../webviews/RedisCli';
import { ErDiagramProvider } from '../webviews/ErDiagram';
import { QueryHistoryService } from '../services/QueryHistoryService';
import { SavedQueryService } from '../services/SavedQueryService';
import { SqlSnippetService } from '../services/SqlSnippetService';
import { QueryExecutorService } from '../services/QueryExecutorService';
import { StatusBarManager } from '../services/StatusBarManager';
import { DatabaseObjectCacheService } from '../services/DatabaseObjectCacheService';
import type { DatabaseConnection } from '../types';

export class CommandHandler {
  private connectionForm: ConnectionFormProvider;
  private queryResult: QueryResultView;
  private tableEditor: TableEditorProvider;
  private redisCli: RedisCliProvider;
  private erDiagram: ErDiagramProvider;

  constructor(
    private context: vscode.ExtensionContext,
    private connectionManager: ConnectionManager,
    private queryHistoryService: QueryHistoryService,
    private savedQueryService: SavedQueryService,
    private sqlSnippetService: SqlSnippetService,
    private queryExecutorService: QueryExecutorService,
    private statusBarManager: StatusBarManager,
    private objectCacheService: DatabaseObjectCacheService
  ) {
    this.connectionForm = new ConnectionFormProvider(context.extensionPath);
    this.queryResult = QueryResultView.getInstance();
    this.tableEditor = new TableEditorProvider(context.extensionPath);
    this.redisCli = new RedisCliProvider(context.extensionPath);
    this.erDiagram = new ErDiagramProvider(context.extensionPath);
    
    this.registerCommands();
  }

  private registerCommands(): void {
    // 连接管理命令
    this.registerCommand('berry-db.addConnection', () => this.addConnection());
    this.registerCommand('berry-db.editConnection', (id?: string) => this.editConnection(id));
    this.registerCommand('berry-db.deleteConnection', (id?: string) => this.deleteConnection(id));
    this.registerCommand('berry-db.connect', (id?: string) => this.connect(id));
    this.registerCommand('berry-db.disconnect', (id?: string) => this.disconnect(id));
    this.registerCommand('berry-db.refreshConnection', () => this.refreshConnection());
    this.registerCommand('berry-db.refreshCache', (id?: string) => this.refreshCache(id));
    
    // 查询命令
    this.registerCommand('berry-db.newQuery', () => this.newQuery());
    this.registerCommand('berry-db.openQueryEditor', () => this.openQueryEditor());
    this.registerCommand('berry-db.executeQuery', () => this.executeQuery());
    this.registerCommand('berry-db.rerunQuery', (item: any) => this.rerunQuery(item));
    this.registerCommand('berry-db.clearQueryHistory', () => this.clearQueryHistory());
    this.registerCommand('berry-db.saveQuery', () => this.saveQuery());
    this.registerCommand('berry-db.showSavedQueries', () => this.showSavedQueries());
    this.registerCommand('berry-db.insertSnippet', () => this.insertSnippet());
    
    // 表管理命令
    this.registerCommand('berry-db.createTable', (connId?: string, database?: string) => 
      this.createTable(connId, database));
    this.registerCommand('berry-db.viewTableData', (connId?: string, database?: string, table?: string) =>
      this.viewTableData(connId, database, table));
    this.registerCommand('berry-db.viewTableStructure', (connId?: string, database?: string, table?: string) =>
      this.viewTableStructure(connId, database, table));
    this.registerCommand('berry-db.editTableStructure', (connId?: string, database?: string, table?: string) =>
      this.editTableStructure(connId, database, table));
    this.registerCommand('berry-db.dropTable', (connId?: string, database?: string, table?: string) =>
      this.dropTable(connId, database, table));
    this.registerCommand('berry-db.truncateTable', (connId?: string, database?: string, table?: string) =>
      this.truncateTable(connId, database, table));
    
    // 数据导入导出
    this.registerCommand('berry-db.exportData', () => this.exportData());
    this.registerCommand('berry-db.importData', () => this.importData());
    
    // Redis 命令
    this.registerCommand('berry-db.viewRedisKey', (connId?: string, key?: string) =>
      this.viewRedisKey(connId, key));
    this.registerCommand('berry-db.deleteRedisKey', (connId?: string, key?: string) =>
      this.deleteRedisKey(connId, key));
    this.registerCommand('berry-db.openRedisCLI', (connId?: string) => this.openRedisCli(connId));
    
    // ER 图
    this.registerCommand('berry-db.showERDiagram', (connId?: string, database?: string) => 
      this.showErDiagram(connId, database));
  }

  private registerCommand(command: string, callback: (...args: any[]) => any): void {
    const disposable = vscode.commands.registerCommand(command, callback, this);
    this.context.subscriptions.push(disposable);
  }

  // ==================== 连接管理 ====================

  async addConnection(): Promise<void> {
    this.connectionForm.show();
    this.connectionForm.onDidSave = async (connection: DatabaseConnection) => {
      try {
        await this.connectionManager.addConnection(connection);
        vscode.window.showInformationMessage(`连接 "${connection.name}" 已添加`);
        this.statusBarManager.updateStatusBar();
      } catch (error: any) {
        vscode.window.showErrorMessage(`添加连接失败：${error.message}`);
      }
    };
  }

  async editConnection(connectionId?: string): Promise<void> {
    if (!connectionId) {
      vscode.window.showErrorMessage('未指定连接 ID');
      return;
    }
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      vscode.window.showErrorMessage('连接不存在');
      return;
    }
    this.connectionForm.show(connection);
    this.connectionForm.onDidSave = async (updated: DatabaseConnection) => {
      try {
        await this.connectionManager.updateConnection(updated);
        vscode.window.showInformationMessage(`连接 "${updated.name}" 已更新`);
        this.statusBarManager.updateStatusBar();
      } catch (error: any) {
        vscode.window.showErrorMessage(`更新连接失败：${error.message}`);
      }
    };
  }

  async deleteConnection(connectionId?: string): Promise<void> {
    if (!connectionId) return;
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) return;

    const confirm = await vscode.window.showWarningMessage(
      `确定要删除连接 "${connection.name}" 吗？`,
      { modal: true },
      '删除'
    );

    if (confirm === '删除') {
      await this.connectionManager.deleteConnection(connectionId);
      this.statusBarManager.updateStatusBar();
      vscode.window.showInformationMessage('连接已删除');
    }
  }

  async connect(connectionId?: string): Promise<void> {
    if (!connectionId) {
      vscode.window.showErrorMessage('未指定连接 ID');
      return;
    }
    
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      vscode.window.showErrorMessage(`连接不存在：${connectionId}`);
      return;
    }
    
    try {
      console.log(`[Berry DB] 正在连接：${connection.name} (${connection.type})`);
      await this.connectionManager.getService(connectionId);
      console.log(`[Berry DB] 连接成功：${connection.name}`);
      vscode.window.showInformationMessage(`连接成功：${connection.name}`);
      this.statusBarManager.updateStatusBar();
      // 刷新缓存
      await this.objectCacheService.refreshCache(connectionId);
      // 刷新树视图
      vscode.commands.executeCommand('workbench.actions.view.refresh');
      console.log(`[Berry DB] 已刷新树视图`);
    } catch (error: any) {
      console.error(`[Berry DB] 连接失败:`, error);
      vscode.window.showErrorMessage(`连接失败：${error.message}`);
    }
  }

  async disconnect(connectionId?: string): Promise<void> {
    if (!connectionId) return;
    await this.connectionManager.disconnect(connectionId);
    this.statusBarManager.updateStatusBar();
    vscode.window.showInformationMessage('已断开连接');
  }

  async refreshConnection(): Promise<void> {
    vscode.commands.executeCommand('workbench.actions.view.refresh');
  }

  async refreshCache(connectionId?: string): Promise<void> {
    if (!connectionId) {
      // 刷新所有连接的缓存
      const connections = this.connectionManager.getAllConnections();
      for (const conn of connections) {
        if (this.connectionManager.isConnected(conn.id)) {
          await this.objectCacheService.refreshCache(conn.id);
        }
      }
      vscode.window.showInformationMessage('数据库对象缓存已刷新');
    } else {
      await this.objectCacheService.refreshCache(connectionId);
      vscode.window.showInformationMessage('数据库对象缓存已刷新');
    }
  }

  // ==================== 查询功能 ====================

  async newQuery(): Promise<void> {
    // 创建新的 SQL 查询文档
    const doc = await vscode.workspace.openTextDocument({
      language: 'sql',
      content: `-- 新建查询
-- 在此输入 SQL 语句

SELECT * FROM your_table LIMIT 100;`
    });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    vscode.window.showInformationMessage('已新建查询，输入 SQL 后点击运行按钮执行');
  }

  async openQueryEditor(): Promise<void> {
    await this.newQuery();
  }

  async executeQuery(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('请先打开 SQL 文件');
      return;
    }

    const query = editor.document.getText();
    if (!query.trim()) {
      vscode.window.showErrorMessage('请选择要执行的 SQL 语句');
      return;
    }

    // TODO: 获取当前连接并执行
    vscode.window.showInformationMessage('查询执行功能开发中...');
  }

  async rerunQuery(item: any): Promise<void> {
    if (!item) return;
    const doc = await vscode.workspace.openTextDocument({
      language: 'sql',
      content: item.query
    });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    vscode.window.showInformationMessage('查询已载入编辑器，请执行');
  }

  async clearQueryHistory(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      '确定要清空所有查询历史吗？',
      { modal: true },
      '清空'
    );
    if (confirm === '清空') {
      this.queryHistoryService.clearHistory();
      vscode.window.showInformationMessage('查询历史已清空');
    }
  }

  async saveQuery(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('请先打开 SQL 文件');
      return;
    }

    const query = editor.document.getText();
    const name = await vscode.window.showInputBox({
      prompt: '输入查询名称',
      placeHolder: '例如：用户统计查询'
    });

    if (name && query) {
      this.savedQueryService.saveQuery({ name, query, connectionId: undefined, tags: [] });
      vscode.window.showInformationMessage('查询已保存');
    }
  }

  async showSavedQueries(): Promise<void> {
    const queries = this.savedQueryService.getAllQueries();
    if (queries.length === 0) {
      vscode.window.showInformationMessage('暂无收藏的查询');
      return;
    }

    const items = queries.map(q => ({
      label: q.name,
      description: new Date(q.updatedAt).toLocaleDateString(),
      query: q.query
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '选择要打开的查询'
    });

    if (selected) {
      const doc = await vscode.workspace.openTextDocument({
        language: 'sql',
        content: selected.query
      });
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    }
  }

  async insertSnippet(): Promise<void> {
    await this.sqlSnippetService.showSnippetPicker();
  }

  // ==================== 表管理 ====================

  async createTable(_connectionId?: string, _database?: string): Promise<void> {
    vscode.window.showInformationMessage('创建表功能开发中...');
  }

  async viewTableData(connectionId?: string, _database?: string, table?: string): Promise<void> {
    if (!connectionId || !table) return;
    try {
      const service: any = await this.connectionManager.getService(connectionId);
      const quotedTable = service.quoteIdentifier(table);
      const result = await service.executeQuery(`SELECT * FROM ${quotedTable} LIMIT 100`);
      this.queryResult.show(result);
    } catch (error: any) {
      this.queryResult.show({ columns: [], rows: [], rowCount: 0, duration: 0, success: false, error: error.message });
    }
  }

  async viewTableStructure(connectionId?: string, _database?: string, table?: string): Promise<void> {
    if (!connectionId || !table) return;
    try {
      const service: any = await this.connectionManager.getService(connectionId);
      const detail = await service.getTableDetail(table);
      
      const output = vscode.window.createOutputChannel('表结构');
      output.appendLine(`表：${table}\n`);
      output.appendLine('列信息:');
      detail.columns.forEach(col => {
        output.appendLine(`  ${col.name}: ${col.type} ${col.nullable ? 'NULL' : 'NOT NULL'} ${col.isPrimaryKey ? 'PRIMARY KEY' : ''}`);
      });
      output.appendLine('\n索引:');
      detail.indexes.forEach(idx => {
        output.appendLine(`  ${idx.name}: (${idx.columns.join(', ')}) ${idx.isUnique ? 'UNIQUE' : ''}`);
      });
      output.appendLine('\n外键:');
      detail.foreignKeys.forEach(fk => {
        output.appendLine(`  ${fk.name}: ${fk.columns.join(', ')} -> ${fk.referencedTable}(${fk.referencedColumns.join(', ')})`);
      });
      output.show();
    } catch (error: any) {
      vscode.window.showErrorMessage(`获取表结构失败：${error.message}`);
    }
  }

  async editTableStructure(connectionId?: string, database?: string, table?: string): Promise<void> {
    if (!connectionId || !table) return;
    try {
      const service: any = await this.connectionManager.getService(connectionId);
      const detail = await service.getTableDetail(table);
      await this.tableEditor.show(connectionId, database, table, detail);
    } catch (error: any) {
      vscode.window.showErrorMessage(`获取表结构失败：${error.message}`);
    }
  }

  async dropTable(connectionId?: string, _database?: string, table?: string): Promise<void> {
    if (!connectionId || !table) return;
    const confirm = await vscode.window.showWarningMessage(
      `确定要删除表 "${table}" 吗？此操作不可逆！`,
      { modal: true },
      '删除'
    );
    if (confirm !== '删除') return;
    try {
      const service: any = await this.connectionManager.getService(connectionId);
      await service.dropTable(table);
      vscode.window.showInformationMessage(`表 "${table}" 已删除`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`删除表失败：${error.message}`);
    }
  }

  async truncateTable(connectionId?: string, _database?: string, table?: string): Promise<void> {
    if (!connectionId || !table) return;
    const confirm = await vscode.window.showWarningMessage(
      `确定要清空表 "${table}" 的所有数据吗？`,
      { modal: true },
      '清空'
    );
    if (confirm !== '清空') return;
    try {
      const service: any = await this.connectionManager.getService(connectionId);
      await service.truncateTable(table);
      vscode.window.showInformationMessage(`表 "${table}" 已清空`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`清空表失败：${error.message}`);
    }
  }

  // ==================== 导入导出 ====================

  async exportData(): Promise<void> {
    vscode.window.showInformationMessage('导出功能开发中...');
  }

  async importData(): Promise<void> {
    vscode.window.showInformationMessage('导入功能开发中...');
  }

  // ==================== Redis 功能 ====================

  async viewRedisKey(connectionId?: string, key?: string): Promise<void> {
    if (!connectionId || !key) return;
    try {
      const service: any = await this.connectionManager.getService(connectionId);
      const detail = await service.getKeyDetail(key);
      const output = vscode.window.createOutputChannel('Redis Key');
      output.appendLine(`Key: ${detail.key}`);
      output.appendLine(`类型：${detail.type}`);
      output.appendLine(`TTL: ${detail.ttl}秒`);
      output.appendLine(`\n值:`);
      output.appendLine(JSON.stringify(detail.value, null, 2));
      output.show();
    } catch (error: any) {
      vscode.window.showErrorMessage(`获取 Key 详情失败：${error.message}`);
    }
  }

  async deleteRedisKey(connectionId?: string, key?: string): Promise<void> {
    if (!connectionId || !key) return;
    const confirm = await vscode.window.showWarningMessage(
      `确定要删除 Key "${key}" 吗？`,
      { modal: true },
      '删除'
    );
    if (confirm !== '删除') return;
    try {
      const service: any = await this.connectionManager.getService(connectionId);
      await service.deleteKey(key);
      vscode.window.showInformationMessage(`Key "${key}" 已删除`);
    } catch (error: any) {
      vscode.window.showErrorMessage(`删除 Key 失败：${error.message}`);
    }
  }

  async openRedisCli(connectionId?: string): Promise<void> {
    if (!connectionId) {
      vscode.window.showErrorMessage('请先选择连接');
      return;
    }
    await this.redisCli.show(connectionId);
  }

  // ==================== ER 图 ====================

  async showErDiagram(connectionId?: string, database?: string): Promise<void> {
    if (!connectionId) {
      vscode.window.showErrorMessage('请先选择连接');
      return;
    }
    try {
      const service: any = await this.connectionManager.getService(connectionId);
      const tables = await service.getTables(database);
      const tableDetails = new Map();
      for (const table of tables) {
        const detail = await service.getTableDetail(table.name);
        tableDetails.set(table.name, detail);
      }
      await this.erDiagram.show(connectionId, database, tableDetails);
    } catch (error: any) {
      vscode.window.showErrorMessage(`生成 ER 图失败：${error.message}`);
    }
  }
}
