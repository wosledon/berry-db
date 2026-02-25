/**
 * 数据库服务抽象基类
 */

import {
  IDatabaseService,
  DatabaseConnection,
  TableInfo,
  TableDetail,
  ColumnInfo,
  QueryResult,
  ExportOptions,
  ImportOptions
} from '../../types';

export abstract class DatabaseService implements IDatabaseService {
  protected connection: DatabaseConnection;
  protected connected: boolean = false;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
  }

  /**
   * 获取数据库类型
   */
  abstract getDatabaseType(): string;

  /**
   * 连接到数据库
   */
  abstract connect(): Promise<void>;

  /**
   * 断开连接
   */
  abstract disconnect(): Promise<void>;

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取数据库列表
   */
  abstract getDatabases(): Promise<string[]>;

  /**
   * 获取模式列表
   */
  abstract getSchemas(): Promise<string[]>;

  /**
   * 获取表列表
   */
  abstract getTables(database?: string, schema?: string): Promise<TableInfo[]>;

  /**
   * 获取表详情
   */
  abstract getTableDetail(table: string, schema?: string): Promise<TableDetail>;

  /**
   * 创建表
   */
  abstract createTable(table: string, columns: ColumnInfo[]): Promise<void>;

  /**
   * 删除表
   */
  abstract dropTable(table: string, schema?: string, cascade?: boolean): Promise<void>;

  /**
   * 清空表
   */
  abstract truncateTable(table: string, schema?: string): Promise<void>;

  /**
   * 执行查询
   */
  abstract executeQuery(query: string): Promise<QueryResult>;

  /**
   * 解释查询
   */
  abstract explainQuery(query: string): Promise<QueryResult>;

  /**
   * 插入数据
   */
  abstract insertData(table: string, data: Record<string, any>): Promise<void>;

  /**
   * 更新数据
   */
  abstract updateData(table: string, data: Record<string, any>, where: string): Promise<void>;

  /**
   * 删除数据
   */
  abstract deleteData(table: string, where: string): Promise<void>;

  /**
   * 导出表
   */
  abstract exportTable(table: string, options: ExportOptions): Promise<string>;

  /**
   * 导入表
   */
  abstract importTable(filePath: string, options: ImportOptions): Promise<void>;

  /**
   * 格式化标识符
   */
  abstract quoteIdentifier(identifier: string): string;

  /**
   * 格式化字符串值
   */
  abstract quoteValue(value: string): string;

  /**
   * 获取限制子句
   */
  getLimitClause(limit: number, offset?: number): string {
    let sql = ` LIMIT ${limit}`;
    if (offset !== undefined && offset > 0) {
      sql += ` OFFSET ${offset}`;
    }
    return sql;
  }

  /**
   * 构建分页查询
   */
  buildPaginationQuery(
    table: string,
    columns: string[] = ['*'],
    limit: number = 100,
    offset: number = 0,
    orderBy?: string,
    where?: string
  ): string {
    let sql = `SELECT ${columns.join(', ')} FROM ${this.quoteIdentifier(table)}`;
    
    if (where) {
      sql += ` WHERE ${where}`;
    }
    
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }
    
    sql += this.getLimitClause(limit, offset);
    
    return sql;
  }

  /**
   * 构建计数查询
   */
  buildCountQuery(table: string, where?: string): string {
    let sql = `SELECT COUNT(*) as total FROM ${this.quoteIdentifier(table)}`;
    if (where) {
      sql += ` WHERE ${where}`;
    }
    return sql;
  }

  /**
   * 验证查询是否安全（只读）
   */
  isReadOnlyQuery(query: string): boolean {
    const upperQuery = query.trim().toUpperCase();
    const writeKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE'];
    return !writeKeywords.some(keyword => upperQuery.startsWith(keyword));
  }

  /**
   * 获取当前时间戳
   */
  protected getCurrentTimestamp(): number {
    return Date.now();
  }

  /**
   * 处理查询结果中的特殊值
   */
  protected sanitizeValue(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (value instanceof Buffer) {
      return value.toString('hex');
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  }

  /**
   * 处理查询结果
   */
  protected processQueryResult(
    rows: any[],
    columns: { name: string; type: string }[],
    startTime: number
  ): QueryResult {
    const duration = this.getCurrentTimestamp() - startTime;
    
    const processedRows = rows.map(row => {
      const processed: Record<string, any> = {};
      for (const key in row) {
        processed[key] = this.sanitizeValue(row[key]);
      }
      return processed;
    });

    return {
      columns: columns.map(col => ({
        name: col.name,
        type: col.type,
        nullable: true
      })),
      rows: processedRows,
      rowCount: processedRows.length,
      duration,
      success: true
    };
  }
}
