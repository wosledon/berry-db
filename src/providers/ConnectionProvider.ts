/**
 * 连接树形视图提供者
 */

import * as vscode from 'vscode';
import { ConnectionManager } from '../services/ConnectionManager';
import { DatabaseObjectType } from '../types';
import type { DatabaseConnection } from '../types';
import type { IDatabaseService } from '../types';

export class ConnectionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly type: DatabaseObjectType,
    public readonly connectionId?: string,
    public readonly databaseName?: string,
    public readonly tableName?: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    public readonly contextValue?: string,
    iconPath?: string | vscode.ThemeIcon | { light: vscode.Uri; dark: vscode.Uri },
    command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.id = id;
    this.contextValue = contextValue;
    if (iconPath) {
      this.iconPath = iconPath;
    }
    if (command) {
      this.command = command;
    }
  }
}

export class ConnectionProvider implements vscode.TreeDataProvider<ConnectionTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ConnectionTreeItem | undefined | null | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<ConnectionTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private connectionManager: ConnectionManager;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    
    this.connectionManager.onDidChangeConnections(() => {
      this.refresh();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ConnectionTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ConnectionTreeItem): Promise<ConnectionTreeItem[]> {
    if (!element) {
      return this.getConnections();
    }

    switch (element.type) {
      case DatabaseObjectType.Connection:
        return this.getConnectionChildren(element);
      
      case DatabaseObjectType.Database:
        return this.getDatabaseChildren(element);
      
      case DatabaseObjectType.Tables:
        return this.getTables(element);
      
      case DatabaseObjectType.Views:
        return this.getViews(element);
      
      case DatabaseObjectType.Table:
        return this.getTableChildren(element);
      
      case DatabaseObjectType.Columns:
        return this.getColumns(element);
      
      case DatabaseObjectType.Indexes:
        return this.getIndexes(element);
      
      case DatabaseObjectType.ForeignKeys:
        return this.getForeignKeys(element);
      
      case DatabaseObjectType.RedisKeys:
        return this.getRedisKeys(element);
      
      default:
        return [];
    }
  }

  private getConnections(): ConnectionTreeItem[] {
    const connections = this.connectionManager.getAllConnections();
    
    if (connections.length === 0) {
      return [new ConnectionTreeItem(
        'no-connections',
        '暂无连接，点击 + 新建',
        DatabaseObjectType.Connection,
        undefined,
        undefined,
        undefined,
        vscode.TreeItemCollapsibleState.None,
        undefined,
        new vscode.ThemeIcon('info')
      )];
    }

    return connections.map(conn => {
      const isConnected = this.connectionManager.isConnected(conn.id);

      const item = new ConnectionTreeItem(
        conn.id,
        conn.name,
        DatabaseObjectType.Connection,
        conn.id,
        undefined,
        undefined,
        isConnected ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        isConnected ? 'connectionConnected' : 'connectionDisconnected',
        new vscode.ThemeIcon(isConnected ? 'plug' : 'plug')
      );

      // 只有已连接的节点才能展开，未连接的点击执行连接命令
      if (!isConnected) {
        item.command = {
          command: 'berry-db.connect',
          title: 'Connect',
          arguments: [conn.id]
        };
      }

      return item;
    });
  }

  private async getConnectionChildren(element: ConnectionTreeItem): Promise<ConnectionTreeItem[]> {
    const connection = this.connectionManager.getConnection(element.connectionId!);
    if (!connection) {
      return [];
    }

    if (!this.connectionManager.isConnected(element.connectionId!)) {
      return [new ConnectionTreeItem(
        `${element.id}-connect`,
        '点击连接',
        DatabaseObjectType.Connection,
        element.connectionId,
        undefined,
        undefined,
        vscode.TreeItemCollapsibleState.None,
        undefined,
        new vscode.ThemeIcon('plug'),
        {
          command: 'berry-db.connect',
          title: 'Connect',
          arguments: [element.connectionId]
        }
      )];
    }

    try {
      await this.connectionManager.getService(element.connectionId!);
      
      if (connection.type === 'redis') {
        return this.getRedisRootNodes(element);
      } else {
        return this.getRelationalRootNodes(element, connection);
      }
    } catch (error: any) {
      return [new ConnectionTreeItem(
        `${element.id}-error`,
        `错误：${error.message}`,
        DatabaseObjectType.Connection,
        undefined,
        undefined,
        undefined,
        vscode.TreeItemCollapsibleState.None,
        undefined,
        new vscode.ThemeIcon('error')
      )];
    }
  }

  private getRelationalRootNodes(element: ConnectionTreeItem, connection: DatabaseConnection): ConnectionTreeItem[] {
    const items: ConnectionTreeItem[] = [];

    if (connection.type !== 'sqlite') {
      items.push(new ConnectionTreeItem(
        `${element.id}-databases`,
        'Databases',
        DatabaseObjectType.Database,
        element.connectionId,
        undefined,
        undefined,
        vscode.TreeItemCollapsibleState.Collapsed,
        'databases',
        new vscode.ThemeIcon('database')
      ));
    }

    items.push(new ConnectionTreeItem(
      `${element.id}-tables`,
      'Tables',
      DatabaseObjectType.Tables,
      element.connectionId,
      connection.database,
      undefined,
      vscode.TreeItemCollapsibleState.Collapsed,
      'tables',
      new vscode.ThemeIcon('table'),
      {
        command: 'berry-db.createTable',
        title: 'Create Table',
        arguments: [element.connectionId, connection.database]
      }
    ));

    items.push(new ConnectionTreeItem(
      `${element.id}-views`,
      'Views',
      DatabaseObjectType.Views,
      element.connectionId,
      connection.database,
      undefined,
      vscode.TreeItemCollapsibleState.Collapsed,
      'views',
      new vscode.ThemeIcon('symbol-interface')
    ));

    return items;
  }

  private getRedisRootNodes(element: ConnectionTreeItem): ConnectionTreeItem[] {
    return [
      new ConnectionTreeItem(
        `${element.id}-keys`,
        'Keys',
        DatabaseObjectType.RedisKeys,
        element.connectionId,
        undefined,
        undefined,
        vscode.TreeItemCollapsibleState.Collapsed,
        'redisKeys',
        new vscode.ThemeIcon('key'),
        {
          command: 'berry-db.viewRedisKey',
          title: 'View Key',
          arguments: [element.connectionId, '*']
        }
      )
    ];
  }

  private async getDatabaseChildren(element: ConnectionTreeItem): Promise<ConnectionTreeItem[]> {
    try {
      const service = await this.connectionManager.getService(element.connectionId!);
      const databases = await service.getDatabases();

      return databases.map(db => new ConnectionTreeItem(
        `${element.id}-${db}`,
        db,
        DatabaseObjectType.Database,
        element.connectionId,
        db,
        undefined,
        vscode.TreeItemCollapsibleState.Collapsed,
        'database',
        new vscode.ThemeIcon('database')
      ));
    } catch (error) {
      return [];
    }
  }

  private async getTables(element: ConnectionTreeItem): Promise<ConnectionTreeItem[]> {
    try {
      const service = await this.connectionManager.getService(element.connectionId!);
      const tables = await service.getTables(element.databaseName);

      return tables.map(table => new ConnectionTreeItem(
        `${element.id}-${table.name}`,
        `${table.name} (${table.rowCount || '?'})`,
        DatabaseObjectType.Table,
        element.connectionId,
        element.databaseName,
        table.name,
        vscode.TreeItemCollapsibleState.Collapsed,
        'table',
        new vscode.ThemeIcon('table'),
        {
          command: 'berry-db.viewTableData',
          title: 'View Data',
          arguments: [element.connectionId, element.databaseName, table.name]
        }
      ));
    } catch (error) {
      return [];
    }
  }

  private async getViews(element: ConnectionTreeItem): Promise<ConnectionTreeItem[]> {
    return [];
  }

  private getTableChildren(element: ConnectionTreeItem): ConnectionTreeItem[] {
    return [
      new ConnectionTreeItem(
        `${element.id}-columns`,
        'Columns',
        DatabaseObjectType.Columns,
        element.connectionId,
        element.databaseName,
        element.tableName,
        vscode.TreeItemCollapsibleState.Collapsed,
        'columns',
        new vscode.ThemeIcon('symbol-field')
      ),
      new ConnectionTreeItem(
        `${element.id}-indexes`,
        'Indexes',
        DatabaseObjectType.Indexes,
        element.connectionId,
        element.databaseName,
        element.tableName,
        vscode.TreeItemCollapsibleState.Collapsed,
        'indexes',
        new vscode.ThemeIcon('symbol-key')
      ),
      new ConnectionTreeItem(
        `${element.id}-foreignKeys`,
        'Foreign Keys',
        DatabaseObjectType.ForeignKeys,
        element.connectionId,
        element.databaseName,
        element.tableName,
        vscode.TreeItemCollapsibleState.Collapsed,
        'foreignKeys',
        new vscode.ThemeIcon('link')
      ),
      new ConnectionTreeItem(
        `${element.id}-data`,
        'View Data (100)',
        DatabaseObjectType.Table,
        element.connectionId,
        element.databaseName,
        element.tableName,
        vscode.TreeItemCollapsibleState.None,
        undefined,
        new vscode.ThemeIcon('table'),
        {
          command: 'berry-db.viewTableData',
          title: 'View Data',
          arguments: [element.connectionId, element.databaseName, element.tableName]
        }
      )
    ];
  }

  private async getRedisKeys(element: ConnectionTreeItem): Promise<ConnectionTreeItem[]> {
    try {
      const service = await this.connectionManager.getService(element.connectionId!) as any;
      const keys = await service.getKeys('*');

      return keys.slice(0, 100).map((key: any) => new ConnectionTreeItem(
        `${element.id}-${key.key}`,
        key.key,
        DatabaseObjectType.RedisKey,
        element.connectionId,
        undefined,
        key.key,
        vscode.TreeItemCollapsibleState.None,
        'redisKey',
        this.getRedisTypeIcon(key.type),
        {
          command: 'berry-db.viewRedisKey',
          title: 'View Key',
          arguments: [element.connectionId, key.key]
        }
      ));
    } catch (error) {
      return [];
    }
  }

  private async getColumns(element: ConnectionTreeItem): Promise<ConnectionTreeItem[]> {
    try {
      const service = await this.connectionManager.getService(element.connectionId!) as any;
      const detail = await service.getTableDetail(element.tableName!);
      
      return detail.columns.map(col => new ConnectionTreeItem(
        `${element.id}-${col.name}`,
        `${col.name}  ${col.type}`,
        DatabaseObjectType.Column,
        element.connectionId,
        element.databaseName,
        element.tableName,
        vscode.TreeItemCollapsibleState.None,
        'column',
        new vscode.ThemeIcon(col.isPrimaryKey ? 'symbol-key' : 'symbol-field'),
        undefined
      ));
    } catch (error) {
      return [];
    }
  }

  private async getIndexes(element: ConnectionTreeItem): Promise<ConnectionTreeItem[]> {
    try {
      const service = await this.connectionManager.getService(element.connectionId!) as any;
      const detail = await service.getTableDetail(element.tableName!);
      
      return detail.indexes.map(idx => new ConnectionTreeItem(
        `${element.id}-${idx.name}`,
        `${idx.name} (${idx.columns.join(', ')})`,
        DatabaseObjectType.Index,
        element.connectionId,
        element.databaseName,
        element.tableName,
        vscode.TreeItemCollapsibleState.None,
        'index',
        new vscode.ThemeIcon(idx.isPrimary ? 'symbol-key' : 'symbol-key'),
        undefined
      ));
    } catch (error) {
      return [];
    }
  }

  private async getForeignKeys(element: ConnectionTreeItem): Promise<ConnectionTreeItem[]> {
    try {
      const service = await this.connectionManager.getService(element.connectionId!) as any;
      const detail = await service.getTableDetail(element.tableName!);
      
      return detail.foreignKeys.map(fk => new ConnectionTreeItem(
        `${element.id}-${fk.name}`,
        `${fk.columns.join(', ')} → ${fk.referencedTable}(${fk.referencedColumns.join(', ')})`,
        DatabaseObjectType.ForeignKey,
        element.connectionId,
        element.databaseName,
        element.tableName,
        vscode.TreeItemCollapsibleState.None,
        'foreignKey',
        new vscode.ThemeIcon('link'),
        undefined
      ));
    } catch (error) {
      return [];
    }
  }

  private getRedisTypeIcon(type: string): vscode.ThemeIcon {
    const iconMap: Record<string, vscode.ThemeIcon> = {
      'string': new vscode.ThemeIcon('symbol-string'),
      'hash': new vscode.ThemeIcon('symbol-object'),
      'list': new vscode.ThemeIcon('list-unordered'),
      'set': new vscode.ThemeIcon('symbol-set'),
      'zset': new vscode.ThemeIcon('symbol-array')
    };
    return iconMap[type] || new vscode.ThemeIcon('key');
  }
}
