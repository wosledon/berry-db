/**
 * 连接管理器
 * 负责管理数据库连接的创建、存储和复用
 */

import * as vscode from 'vscode';
import { DatabaseConnection, ConnectionStatus, IDatabaseService } from '../types';
import { SqliteService } from './database/SqliteService';
import { PostgresService } from './database/PostgresService';
import { MySqlService } from './database/MySqlService';
import { RedisService } from './database/RedisService';

export class ConnectionManager implements vscode.Disposable {
  private static instance: ConnectionManager;

  private connections: Map<string, DatabaseConnection> = new Map();
  private services: Map<string, IDatabaseService> = new Map();
  private secretStorage: vscode.SecretStorage;
  public onDidChangeConnectionsEmitter: vscode.EventEmitter<void>;

  public readonly onDidChangeConnections: vscode.Event<void>;

  private constructor(context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
    this.onDidChangeConnectionsEmitter = new vscode.EventEmitter<void>();
    this.onDidChangeConnections = this.onDidChangeConnectionsEmitter.event;
  }

  /**
   * 初始化单例
   */
  public static async create(context: vscode.ExtensionContext): Promise<ConnectionManager> {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager(context);
      await ConnectionManager.instance.loadConnections();
    }
    return ConnectionManager.instance;
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      throw new Error('ConnectionManager 未初始化');
    }
    return ConnectionManager.instance;
  }

  /**
   * 从存储中加载连接
   */
  private async loadConnections(): Promise<void> {
    const stored = await vscode.workspace.getConfiguration('berry-db').get('connections');
    if (stored && Array.isArray(stored)) {
      for (const conn of stored as any[]) {
        // 从 SecretStorage 恢复密码
        const password = await this.secretStorage.get(`password:${conn.id}`);
        if (password) {
          conn.password = password;
        }
        this.connections.set(conn.id, conn);
      }
      this.onDidChangeConnectionsEmitter.fire(undefined);
    }
  }

  /**
   * 保存连接到存储
   */
  private async saveConnections(): Promise<void> {
    const connectionsArray = Array.from(this.connections.values());
    await vscode.workspace.getConfiguration('berry-db').update(
      'connections',
      connectionsArray,
      vscode.ConfigurationTarget.Global
    );
  }

  /**
   * 添加连接
   */
  async addConnection(connection: DatabaseConnection): Promise<void> {
    this.connections.set(connection.id, connection);
    
    // 存储密码到 SecretStorage
    if (connection.password) {
      await this.secretStorage.store(`password:${connection.id}`, connection.password);
      connection.password = undefined; // 不保存在普通配置中
    }
    
    await this.saveConnections();
    this.onDidChangeConnectionsEmitter.fire(undefined);
  }

  /**
   * 更新连接
   */
  async updateConnection(connection: DatabaseConnection): Promise<void> {
    const existing = this.connections.get(connection.id);
    if (!existing) {
      throw new Error('连接不存在');
    }

    // 保留密码
    if (!connection.password) {
      const storedPassword = await this.secretStorage.get(`password:${connection.id}`);
      connection.password = storedPassword;
    } else {
      await this.secretStorage.store(`password:${connection.id}`, connection.password);
      connection.password = undefined;
    }

    this.connections.set(connection.id, connection);
    await this.saveConnections();
    
    // 如果已连接，断开旧连接
    if (this.services.has(connection.id)) {
      await this.disconnect(connection.id);
    }
    
    this.onDidChangeConnectionsEmitter.fire(undefined);
  }

  /**
   * 删除连接
   */
  async deleteConnection(connectionId: string): Promise<void> {
    // 先断开连接
    if (this.services.has(connectionId)) {
      await this.disconnect(connectionId);
    }

    // 删除密码
    await this.secretStorage.delete(`password:${connectionId}`);
    
    this.connections.delete(connectionId);
    await this.saveConnections();
    this.onDidChangeConnectionsEmitter.fire(undefined);
  }

  /**
   * 获取连接
   */
  getConnection(connectionId: string): DatabaseConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * 获取所有连接
   */
  getAllConnections(): DatabaseConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * 获取数据库服务
   */
  async getService(connectionId: string): Promise<IDatabaseService> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('连接不存在');
    }

    // 如果已有服务实例，返回
    if (this.services.has(connectionId)) {
      const service = this.services.get(connectionId)!;
      if (!service.isConnected()) {
        await service.connect();
      }
      return service;
    }

    // 创建新服务
    const service = this.createService(connection);
    
    // 加载密码
    const password = await this.secretStorage.get(`password:${connectionId}`);
    connection.password = password;

    await service.connect();
    this.services.set(connectionId, service);
    
    return service;
  }

  /**
   * 创建数据库服务
   */
  private createService(connection: DatabaseConnection): IDatabaseService {
    switch (connection.type) {
      case 'sqlite':
        return new SqliteService(connection);
      case 'postgresql':
        return new PostgresService(connection);
      case 'mysql':
        return new MySqlService(connection);
      case 'redis':
        return new RedisService(connection);
      default:
        throw new Error(`不支持的数据库类型：${connection.type}`);
    }
  }

  /**
   * 测试连接
   */
  async testConnection(connection: DatabaseConnection): Promise<{ success: boolean; message: string }> {
    try {
      const service = this.createService(connection);
      
      // 加载密码
      if (!connection.password) {
        const password = await this.secretStorage.get(`password:${connection.id}`);
        connection.password = password;
      }

      await service.connect();
      await service.disconnect();
      
      return { success: true, message: '连接成功' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * 断开连接
   */
  async disconnect(connectionId: string): Promise<void> {
    const service = this.services.get(connectionId);
    if (service) {
      await service.disconnect();
      this.services.delete(connectionId);
      this.onDidChangeConnectionsEmitter.fire(undefined);
    }
  }

  /**
   * 断开所有连接
   */
  async disconnectAll(): Promise<void> {
    for (const connectionId of this.services.keys()) {
      await this.disconnect(connectionId);
    }
  }

  /**
   * 检查连接是否已连接
   */
  isConnected(connectionId: string): boolean {
    const service = this.services.get(connectionId);
    return service?.isConnected() ?? false;
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(connectionId: string): ConnectionStatus {
    if (!this.connections.has(connectionId)) {
      return ConnectionStatus.Disconnected;
    }
    if (this.services.has(connectionId) && this.services.get(connectionId)?.isConnected()) {
      return ConnectionStatus.Connected;
    }
    return ConnectionStatus.Disconnected;
  }

  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    await this.disconnectAll();
    this.onDidChangeConnectionsEmitter.dispose();
  }
}
