/**
 * 数据库对象缓存服务
 * 缓存数据库、表、列等元数据用于智能提示
 */

import * as vscode from 'vscode';
import type { ConnectionManager } from './ConnectionManager';

export interface DatabaseObject {
  name: string;
  type: 'database' | 'schema' | 'table' | 'column' | 'view' | 'function' | 'procedure';
  parent?: string;
  dataType?: string;
  description?: string;
}

export interface ObjectCache {
  connectionId: string;
  databases: DatabaseObject[];
  tables: Map<string, DatabaseObject[]>; // table name -> columns
  lastUpdated: number;
}

export class DatabaseObjectCacheService implements vscode.Disposable {
  private caches: Map<string, ObjectCache> = new Map();
  private refreshTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private _onDidChangeCache: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
  
  public readonly onDidChangeCache: vscode.Event<string> = this._onDidChangeCache.event;

  constructor(private connectionManager: ConnectionManager) {
    // 监听连接变化
    this.connectionManager.onDidChangeConnections(async () => {
      await this.refreshAllCaches();
    });
  }

  private async refreshAllCaches(): Promise<void> {
    const connections = this.connectionManager.getAllConnections();
    for (const conn of connections) {
      if (this.connectionManager.isConnected(conn.id)) {
        await this.refreshCache(conn.id);
      }
    }
  }

  /**
   * 刷新对象缓存
   */
  async refreshCache(connectionId: string): Promise<void> {
    try {
      const service: any = await this.connectionManager.getService(connectionId);
      if (!service || !service.isConnected()) {
        return;
      }

      const cache: ObjectCache = {
        connectionId,
        databases: [],
        tables: new Map(),
        lastUpdated: Date.now()
      };

      // 获取数据库列表
      if (service.getDatabases) {
        const databases = await service.getDatabases();
        cache.databases = databases.map(db => ({
          name: db,
          type: 'database' as const
        }));
      }

      // 获取表列表
      if (service.getTables) {
        const tables = await service.getTables();
        for (const table of tables) {
          // 获取表列
          if (service.getTableDetail) {
            const detail = await service.getTableDetail(table.name);
            const columns = detail.columns.map(col => ({
              name: col.name,
              type: 'column' as const,
              parent: table.name,
              dataType: col.type,
              description: col.comment
            }));
            cache.tables.set(table.name, columns);
          }
        }
      }

      this.caches.set(connectionId, cache);
      this._onDidChangeCache.fire(connectionId);

      // 设置定时刷新（5 分钟）
      if (this.refreshTimeouts.has(connectionId)) {
        clearTimeout(this.refreshTimeouts.get(connectionId));
      }
      this.refreshTimeouts.set(connectionId, setTimeout(() => {
        this.refreshCache(connectionId);
      }, 5 * 60 * 1000));

    } catch (error) {
      console.error(`刷新缓存失败 ${connectionId}:`, error);
    }
  }

  /**
   * 获取数据库列表
   */
  getDatabases(connectionId: string): DatabaseObject[] {
    const cache = this.caches.get(connectionId);
    return cache?.databases || [];
  }

  /**
   * 获取表列表
   */
  getTables(connectionId: string, database?: string): DatabaseObject[] {
    const cache = this.caches.get(connectionId);
    if (!cache) return [];

    const tables: DatabaseObject[] = [];
    cache.tables.forEach((columns, tableName) => {
      tables.push({
        name: tableName,
        type: 'table',
        parent: database
      });
    });
    return tables;
  }

  /**
   * 获取表的列
   */
  getColumns(connectionId: string, tableName: string): DatabaseObject[] {
    const cache = this.caches.get(connectionId);
    if (!cache) return [];

    const columns = cache.tables.get(tableName);
    return columns || [];
  }

  /**
   * 搜索对象
   */
  searchObjects(connectionId: string, query: string, type?: DatabaseObject['type']): DatabaseObject[] {
    const cache = this.caches.get(connectionId);
    if (!cache) return [];

    const results: DatabaseObject[] = [];
    const lowerQuery = query.toLowerCase();

    // 搜索数据库
    if (!type || type === 'database') {
      cache.databases.forEach(db => {
        if (db.name.toLowerCase().includes(lowerQuery)) {
          results.push(db);
        }
      });
    }

    // 搜索表
    if (!type || type === 'table') {
      cache.tables.forEach((columns, tableName) => {
        if (tableName.toLowerCase().includes(lowerQuery)) {
          results.push({
            name: tableName,
            type: 'table',
            parent: columns[0]?.parent
          });
        }
      });
    }

    // 搜索列
    if (!type || type === 'column') {
      cache.tables.forEach((columns, tableName) => {
        columns.forEach(col => {
          if (col.name.toLowerCase().includes(lowerQuery)) {
            results.push({
              ...col,
              parent: tableName
            });
          }
        });
      });
    }

    return results.slice(0, 50); // 限制结果数量
  }

  /**
   * 清除缓存
   */
  clearCache(connectionId?: string): void {
    if (connectionId) {
      this.caches.delete(connectionId);
      const timeout = this.refreshTimeouts.get(connectionId);
      if (timeout) {
        clearTimeout(timeout);
        this.refreshTimeouts.delete(connectionId);
      }
    } else {
      this.caches.clear();
      this.refreshTimeouts.forEach(timeout => clearTimeout(timeout));
      this.refreshTimeouts.clear();
    }
  }

  /**
   * 检查缓存是否存在
   */
  hasCache(connectionId: string): boolean {
    return this.caches.has(connectionId);
  }

  /**
   * 获取缓存时间
   */
  getCacheAge(connectionId: string): number {
    const cache = this.caches.get(connectionId);
    if (!cache) return Infinity;
    return Date.now() - cache.lastUpdated;
  }

  dispose(): void {
    this._onDidChangeCache.dispose();
    this.refreshTimeouts.forEach(timeout => clearTimeout(timeout));
    this.caches.clear();
  }
}
