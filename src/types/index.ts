/**
 * Berry DB - 核心类型定义
 */

/**
 * 数据库类型
 */
export type DatabaseType = 'sqlite' | 'postgresql' | 'mysql' | 'redis';

/**
 * 连接状态
 */
export enum ConnectionStatus {
  Disconnected = 'disconnected',
  Connected = 'connected',
  Connecting = 'connecting',
  Error = 'error'
}

/**
 * SSH 隧道配置
 */
export interface SSHTunnelConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

/**
 * 数据库连接配置
 */
export interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  // 通用配置
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string; // 加密存储
  // SQLite 特有
  filePath?: string;
  // 高级选项
  ssl?: boolean;
  sshTunnel?: SSHTunnelConfig;
  connectionTimeout?: number;
  queryTimeout?: number;
  // 状态
  status?: ConnectionStatus;
}

/**
 * 表信息
 */
export interface TableInfo {
  name: string;
  schema?: string;
  type: 'table' | 'view';
  rowCount?: number;
  description?: string;
}

/**
 * 列信息
 */
export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  isUnique: boolean;
  comment?: string;
  ordinalPosition: number;
}

/**
 * 索引信息
 */
export interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
  type?: string;
}

/**
 * 外键信息
 */
export interface ForeignKeyInfo {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete: string;
  onUpdate: string;
}

/**
 * 表结构详情
 */
export interface TableDetail {
  table: TableInfo;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  foreignKeys: ForeignKeyInfo[];
}

/**
 * 查询结果
 */
export interface QueryResult {
  columns: QueryColumn[];
  rows: Record<string, any>[];
  rowCount: number;
  affectedRows?: number;
  duration: number;
  error?: string;
  success: boolean;
}

/**
 * 查询列定义
 */
export interface QueryColumn {
  name: string;
  type: string;
  nullable?: boolean;
}

/**
 * 数据库对象类型
 */
export enum DatabaseObjectType {
  Connection = 'connection',
  Database = 'database',
  Tables = 'tables',
  Table = 'table',
  Columns = 'columns',
  Column = 'column',
  Indexes = 'indexes',
  Index = 'index',
  ForeignKeys = 'foreignKeys',
  ForeignKey = 'foreignKey',
  Views = 'views',
  View = 'view',
  Routines = 'routines',
  Routine = 'routine',
  RedisKeys = 'redisKeys',
  RedisKey = 'redisKey'
}

/**
 * 树节点项
 */
export interface TreeItem {
  id: string;
  label: string;
  type: DatabaseObjectType;
  connectionId?: string;
  databaseName?: string;
  tableName?: string;
  collapsibleState: CollapsibleState;
  iconPath?: string | { light: string; dark: string };
  contextValue?: string;
  command?: {
    command: string;
    title: string;
    arguments?: any[];
  };
}

/**
 * 折叠状态
 */
export enum CollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2
}

/**
 * Redis Key 信息
 */
export interface RedisKeyInfo {
  key: string;
  type: 'string' | 'hash' | 'list' | 'set' | 'zset';
  ttl: number;
  size?: number;
}

/**
 * Redis Key 详情
 */
export interface RedisKeyDetail {
  key: string;
  type: 'string' | 'hash' | 'list' | 'set' | 'zset';
  ttl: number;
  value: any;
  length?: number;
}

/**
 * 导出选项
 */
export interface ExportOptions {
  format: 'csv' | 'json' | 'sql' | 'excel';
  tables?: string[];
  query?: string;
  includeStructure?: boolean;
  includeData?: boolean;
  outputPath: string;
}

/**
 * 导入选项
 */
export interface ImportOptions {
  format: 'csv' | 'json' | 'sql';
  targetTable: string;
  filePath: string;
  columnMapping?: Record<string, string>;
}

/**
 * 查询历史项
 */
export interface QueryHistoryItem {
  id: string;
  connectionId: string;
  databaseName?: string;
  query: string;
  timestamp: number;
  duration?: number;
  success: boolean;
  error?: string;
}

/**
 * 收藏查询
 */
export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  connectionId?: string;
  query: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

/**
 * ER 图节点
 */
export interface ERNode {
  table: string;
  columns: ColumnInfo[];
  x?: number;
  y?: number;
}

/**
 * ER 图关系
 */
export interface ERRelation {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

/**
 * ER 图数据
 */
export interface ERDiagram {
  nodes: ERNode[];
  relations: ERRelation[];
}

/**
 * 连接池配置
 */
export interface ConnectionPoolConfig {
  max: number;
  min: number;
  idleTimeoutMillis: number;
  acquireTimeoutMillis: number;
}

/**
 * 数据库服务接口
 */
export interface IDatabaseService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // 数据库/模式
  getDatabases(): Promise<string[]>;
  getSchemas(): Promise<string[]>;
  
  // 表
  getTables(database?: string, schema?: string): Promise<TableInfo[]>;
  getTableDetail(table: string, schema?: string): Promise<TableDetail>;
  createTable(table: string, columns: ColumnInfo[]): Promise<void>;
  dropTable(table: string, schema?: string, cascade?: boolean): Promise<void>;
  truncateTable(table: string, schema?: string): Promise<void>;
  
  // 查询
  executeQuery(query: string): Promise<QueryResult>;
  explainQuery(query: string): Promise<QueryResult>;
  
  // 数据操作
  insertData(table: string, data: Record<string, any>): Promise<void>;
  updateData(table: string, data: Record<string, any>, where: string): Promise<void>;
  deleteData(table: string, where: string): Promise<void>;
  
  // 导出/导入
  exportTable(table: string, options: ExportOptions): Promise<string>;
  importTable(filePath: string, options: ImportOptions): Promise<void>;
}

/**
 * 事件发射器
 */
export interface EventEmitter<T> {
  fire(data: T): void;
  dispose(): void;
}

/**
 * 日志级别
 */
export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warning = 2,
  Error = 3
}

/**
 * 日志条目
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  source?: string;
}
