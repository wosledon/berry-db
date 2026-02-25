/**
 * Redis 数据库服务实现
 */

import Redis, { RedisOptions } from 'ioredis';
import { DatabaseService } from './DatabaseService';
import {
  DatabaseConnection,
  TableInfo,
  TableDetail,
  QueryResult,
  ExportOptions,
  ImportOptions,
  RedisKeyInfo,
  RedisKeyDetail
} from '../../types';
import * as fs from 'fs';

export class RedisService extends DatabaseService {
  private client?: Redis;

  constructor(connection: DatabaseConnection) {
    super(connection);
  }

  getDatabaseType(): string {
    return 'Redis';
  }

  async connect(): Promise<void> {
    const config: RedisOptions = {
      host: this.connection.host || 'localhost',
      port: this.connection.port || 6379,
      password: this.connection.password,
      db: this.connection.database ? Number(this.connection.database) : 0,
      connectTimeout: this.connection.connectionTimeout || 10000,
      retryStrategy: (times: number) => {
        if (times > 3) {
          return null;
        }
        return Math.min(times * 50, 2000);
      }
    };

    this.client = new Redis(config);

    return new Promise((resolve, reject) => {
      this.client!.on('connect', () => {
        this.connected = true;
        resolve();
      });

      this.client!.on('error', (err) => {
        reject(err);
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = undefined;
      this.connected = false;
    }
  }

  async getDatabases(): Promise<string[]> {
    // Redis 支持 0-15 共 16 个数据库
    return Array.from({ length: 16 }, (_, i) => `DB ${i}`);
  }

  async getSchemas(): Promise<string[]> {
    return [];
  }

  async getTables(database?: string): Promise<TableInfo[]> {
    // Redis 没有表的概念，返回 Key 类型统计
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const types = ['string', 'hash', 'list', 'set', 'zset'];
    const tables: TableInfo[] = [];

    for (const type of types) {
      tables.push({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        type: 'table',
        description: `${type} keys`
      });
    }

    return tables;
  }

  async getTableDetail(table: string): Promise<TableDetail> {
    // Redis 没有表结构，抛出异常
    throw new Error('Redis 不支持表结构查询');
  }

  async createTable(): Promise<void> {
    throw new Error('Redis 不支持创建表');
  }

  async dropTable(): Promise<void> {
    throw new Error('Redis 不支持删除表');
  }

  async truncateTable(table: string): Promise<void> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    // 删除所有匹配该类型的 key
    const keys = await this.client.keys('*');
    for (const key of keys) {
      const type = await this.client.type(key);
      if (type === table.toLowerCase()) {
        await this.client.del(key);
      }
    }
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const startTime = this.getCurrentTimestamp();

    try {
      // 支持简单的 Redis 命令
      const parts = query.trim().split(/\s+/);
      const command = parts[0].toUpperCase();
      const args = parts.slice(1);

      const result = await this.client.call(command, ...args);

      return {
        columns: [{ name: 'result', type: 'STRING' }],
        rows: [{ result: this.formatRedisResult(result) }],
        rowCount: 1,
        duration: this.getCurrentTimestamp() - startTime,
        success: true
      };
    } catch (error: any) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        duration: this.getCurrentTimestamp() - startTime,
        error: error.message,
        success: false
      };
    }
  }

  private formatRedisResult(result: any): string {
    if (result === null || result === undefined) {
      return '(nil)';
    }
    if (Array.isArray(result)) {
      return result.map((item, i) => `${i + 1}) ${this.formatRedisResult(item)}`).join('\n');
    }
    if (typeof result === 'object') {
      return JSON.stringify(result);
    }
    return String(result);
  }

  async explainQuery(): Promise<QueryResult> {
    throw new Error('Redis 不支持 EXPLAIN');
  }

  async insertData(): Promise<void> {
    throw new Error('Redis 不支持 INSERT，请使用 SET/HSET/LPUSH 等命令');
  }

  async updateData(): Promise<void> {
    throw new Error('Redis 不支持 UPDATE，请使用 SET/HSET 等命令');
  }

  async deleteData(): Promise<void> {
    throw new Error('Redis 不支持 DELETE，请使用 DEL 命令');
  }

  async exportTable(table: string, options: ExportOptions): Promise<string> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const keys = await this.client.keys('*');
    const data: any[] = [];

    for (const key of keys) {
      const type = await this.client.type(key);
      if (table.toLowerCase() === 'all' || type === table.toLowerCase()) {
        const value = await this.getRedisValue(key, type);
        data.push({
          key,
          type,
          value,
          ttl: await this.client.ttl(key)
        });
      }
    }

    if (options.format === 'json') {
      const json = JSON.stringify(data, null, 2);
      fs.writeFileSync(options.outputPath, json);
      return options.outputPath;
    }

    throw new Error(`Redis 仅支持 JSON 格式导出`);
  }

  async importTable(filePath: string, options: ImportOptions): Promise<void> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      const pipeline = this.client.pipeline();

      for (const item of data) {
        const { key, type, value } = item;

        switch (type) {
          case 'string':
            pipeline.set(key, value);
            break;
          case 'hash':
            if (typeof value === 'object') {
              pipeline.hset(key, value);
            }
            break;
          case 'list':
            if (Array.isArray(value)) {
              for (const v of value) {
                pipeline.rpush(key, v);
              }
            }
            break;
          case 'set':
            if (Array.isArray(value)) {
              for (const v of value) {
                pipeline.sadd(key, v);
              }
            }
            break;
          case 'zset':
            if (Array.isArray(value)) {
              for (const v of value) {
                pipeline.zadd(key, v.score, v.member);
              }
            }
            break;
        }
      }

      await pipeline.exec();
    }
  }

  /**
   * 获取 Redis Key 列表
   */
  async getKeys(pattern: string = '*'): Promise<RedisKeyInfo[]> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const keys = await this.client.keys(pattern);
    const keyInfos: RedisKeyInfo[] = [];

    for (const key of keys) {
      const [type, ttl] = await Promise.all([
        this.client.type(key),
        this.client.ttl(key)
      ]);

      keyInfos.push({
        key,
        type: type as any,
        ttl
      });
    }

    return keyInfos;
  }

  /**
   * 获取 Redis Key 详情
   */
  async getKeyDetail(key: string): Promise<RedisKeyDetail> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const [type, ttl] = await Promise.all([
      this.client.type(key),
      this.client.ttl(key)
    ]);

    const value = await this.getRedisValue(key, type);
    const length = await this.getRedisLength(key, type);

    return {
      key,
      type: type as any,
      ttl,
      value,
      length
    };
  }

  private async getRedisValue(key: string, type: string): Promise<any> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    switch (type) {
      case 'string':
        return await this.client.get(key);
      case 'hash':
        return await this.client.hgetall(key);
      case 'list':
        return await this.client.lrange(key, 0, -1);
      case 'set':
        return await this.client.smembers(key);
      case 'zset':
        return await this.client.zrange(key, 0, -1, 'WITHSCORES');
      default:
        return await this.client.get(key);
    }
  }

  private async getRedisLength(key: string, type: string): Promise<number | undefined> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    switch (type) {
      case 'string':
        const val = await this.client.get(key);
        return val ? val.length : 0;
      case 'hash':
        return await this.client.hlen(key);
      case 'list':
        return await this.client.llen(key);
      case 'set':
        return await this.client.scard(key);
      case 'zset':
        return await this.client.zcard(key);
      default:
        return undefined;
    }
  }

  /**
   * 设置 Key 的值
   */
  async setKey(key: string, type: string, value: any, ttl?: number): Promise<void> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    switch (type.toLowerCase()) {
      case 'string':
        await this.client.set(key, value);
        break;
      case 'hash':
        if (typeof value === 'object') {
          await this.client.hset(key, value);
        }
        break;
      case 'list':
        if (Array.isArray(value)) {
          await this.client.del(key);
          for (const v of value) {
            await this.client.rpush(key, v);
          }
        }
        break;
      case 'set':
        if (Array.isArray(value)) {
          await this.client.del(key);
          for (const v of value) {
            await this.client.sadd(key, v);
          }
        }
        break;
      case 'zset':
        if (Array.isArray(value)) {
          await this.client.del(key);
          for (const v of value) {
            await this.client.zadd(key, v.score, v.member);
          }
        }
        break;
    }

    if (ttl && ttl > 0) {
      await this.client.expire(key, ttl);
    }
  }

  /**
   * 删除 Key
   */
  async deleteKey(key: string): Promise<void> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    await this.client.del(key);
  }

  /**
   * 批量删除 Keys
   */
  async deleteKeys(pattern: string): Promise<number> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const keys = await this.client.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }

    return await this.client.del(...keys);
  }

  /**
   * 刷新 Key 的 TTL
   */
  async refreshTTL(key: string, ttl: number): Promise<void> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    if (ttl <= 0) {
      await this.client.persist(key);
    } else {
      await this.client.expire(key, ttl);
    }
  }

  /**
   * 执行 Redis 命令
   */
  async executeCommand(command: string, args: any[] = []): Promise<any> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    return await this.client.call(command.toUpperCase(), ...args);
  }

  quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  quoteValue(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }
}
