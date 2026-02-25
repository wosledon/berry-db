/**
 * SQLite 数据库服务实现 (使用 sql.js - WASM 版本)
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from './DatabaseService';
import {
  DatabaseConnection,
  TableInfo,
  TableDetail,
  ColumnInfo,
  IndexInfo,
  ForeignKeyInfo,
  QueryResult,
  ExportOptions,
  ImportOptions
} from '../../types';

type Database = SqlJsDatabase;

export class SqliteService extends DatabaseService {
  private db?: Database;
  private sqlJsInitialized: boolean = false;

  constructor(connection: DatabaseConnection) {
    super(connection);
  }

  getDatabaseType(): string {
    return 'SQLite';
  }

  async connect(): Promise<void> {
    try {
      const dbPath = this.connection.filePath;
      
      if (!dbPath) {
        throw new Error('SQLite 数据库文件路径未指定');
      }

      // 初始化 sql.js
      if (!this.sqlJsInitialized) {
        await initSqlJs();
        this.sqlJsInitialized = true;
      }

      // 确保目录存在
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 加载或创建数据库
      if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        const SQL = await initSqlJs();
        this.db = new SQL.Database(fileBuffer);
      } else {
        const SQL = await initSqlJs();
        this.db = new SQL.Database();
      }
      
      this.connected = true;
    } catch (error: any) {
      throw new Error(`SQLite 连接失败：${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.db) {
        // 保存数据到文件
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.connection.filePath!, buffer);
        
        this.db.close();
        this.db = undefined;
      }
      this.connected = false;
    } catch (error: any) {
      throw new Error(`SQLite 断开连接失败：${error.message}`);
    }
  }

  async getDatabases(): Promise<string[]> {
    return ['main'];
  }

  async getSchemas(): Promise<string[]> {
    return ['main'];
  }

  async getTables(database?: string, schema?: string): Promise<TableInfo[]> {
    if (!this.db) {
      throw new Error('未连接到数据库');
    }

    const tables: TableInfo[] = [];
    
    // 获取所有表
    const result = this.db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    if (result.length > 0) {
      const columnNames = result[0].columns;
      const nameIndex = columnNames.indexOf('name');
      
      for (const row of result[0].values) {
        const tableName = row[nameIndex] as string;
        
        // 获取行数
        const countResult = this.db.exec(`SELECT COUNT(*) as count FROM "${tableName}"`);
        let rowCount = 0;
        if (countResult.length > 0) {
          const countIndex = countResult[0].columns.indexOf('count');
          rowCount = countResult[0].values[0][countIndex] as number;
        }

        tables.push({
          name: tableName,
          type: 'table',
          rowCount
        });
      }
    }

    return tables;
  }

  async getTableDetail(table: string, schema?: string): Promise<TableDetail> {
    if (!this.db) {
      throw new Error('未连接到数据库');
    }

    const columns: ColumnInfo[] = [];
    const indexes: IndexInfo[] = [];
    const foreignKeys: ForeignKeyInfo[] = [];

    // 获取列信息
    const pragmaResult = this.db.exec(`PRAGMA table_info("${table}")`);
    
    if (pragmaResult.length > 0) {
      const cols = pragmaResult[0].columns;
      const cidIdx = cols.indexOf('cid');
      const nameIdx = cols.indexOf('name');
      const typeIdx = cols.indexOf('type');
      const notnullIdx = cols.indexOf('notnull');
      const dfltIdx = cols.indexOf('dflt_value');
      const pkIdx = cols.indexOf('pk');

      for (const row of pragmaResult[0].values) {
        columns.push({
          name: row[nameIdx] as string,
          type: row[typeIdx] as string,
          nullable: row[notnullIdx] as number === 0,
          defaultValue: row[dfltIdx] as string,
          isPrimaryKey: (row[pkIdx] as number) > 0,
          isAutoIncrement: false,
          isUnique: false,
          ordinalPosition: row[cidIdx] as number
        });
      }
    }

    // 检查自增
    const createTableSql = this.db.exec(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`
    );

    if (createTableSql.length > 0 && createTableSql[0].values.length > 0) {
      const sqlIndex = createTableSql[0].columns.indexOf('sql');
      const sql = createTableSql[0].values[0][sqlIndex] as string;
      
      if (sql) {
        const upperSql = sql.toUpperCase();
        for (const col of columns) {
          if (col.isPrimaryKey && upperSql.includes(`${col.name.toUpperCase()} INTEGER PRIMARY KEY AUTOINCREMENT`)) {
            col.isAutoIncrement = true;
          }
        }
      }
    }

    // 获取索引信息
    const indexResult = this.db.exec(`PRAGMA index_list("${table}")`);
    
    if (indexResult.length > 0) {
      const idxCols = indexResult[0].columns;
      const nameIdx = idxCols.indexOf('name');
      const uniqueIdx = idxCols.indexOf('unique');
      const originIdx = idxCols.indexOf('origin');

      for (const row of indexResult[0].values) {
        const indexName = row[nameIdx] as string;
        const columnResult = this.db.exec(`PRAGMA index_info("${indexName}")`);
        const indexColumns: string[] = [];
        
        if (columnResult.length > 0) {
          const colNameIdx = columnResult[0].columns.indexOf('name');
          for (const colRow of columnResult[0].values) {
            indexColumns.push(colRow[colNameIdx] as string);
          }
        }
        
        indexes.push({
          name: indexName,
          columns: indexColumns,
          isUnique: row[uniqueIdx] as number !== 0,
          isPrimary: row[originIdx] as string === 'pk',
          type: 'BTREE'
        });
      }
    }

    // 获取外键信息
    const fkResult = this.db.exec(`PRAGMA foreign_key_list("${table}")`);
    
    if (fkResult.length > 0) {
      const fkCols = fkResult[0].columns;
      const idIdx = fkCols.indexOf('id');
      const fromIdx = fkCols.indexOf('from');
      const tableIdx = fkCols.indexOf('table');
      const toIdx = fkCols.indexOf('to');
      const onDelIdx = fkCols.indexOf('on_delete');
      const onUpdIdx = fkCols.indexOf('on_update');

      for (const row of fkResult[0].values) {
        const fkId = row[idIdx] as number;
        let existingFk = foreignKeys.find(f => f.name === `fk_${fkId}`);
        
        if (!existingFk) {
          existingFk = {
            name: `fk_${fkId}`,
            columns: [],
            referencedTable: row[tableIdx] as string,
            referencedColumns: [],
            onDelete: row[onDelIdx] as string || 'NO ACTION',
            onUpdate: row[onUpdIdx] as string || 'NO ACTION'
          };
          foreignKeys.push(existingFk);
        }
        
        existingFk.columns.push(row[fromIdx] as string);
        existingFk.referencedColumns.push(row[toIdx] as string);
      }
    }

    return {
      table: {
        name: table,
        type: 'table',
        description: createTableSql.length > 0 ? (createTableSql[0].values[0][0] as string) : undefined
      },
      columns,
      indexes,
      foreignKeys
    };
  }

  async createTable(table: string, columns: ColumnInfo[]): Promise<void> {
    if (!this.db) {
      throw new Error('未连接到数据库');
    }

    const columnDefs = columns.map(col => {
      let def = `${this.quoteIdentifier(col.name)} ${col.type}`;
      
      if (col.isPrimaryKey) {
        def += ' PRIMARY KEY';
        if (col.isAutoIncrement) {
          def = `${this.quoteIdentifier(col.name)} INTEGER PRIMARY KEY AUTOINCREMENT`;
        }
      }
      
      if (!col.nullable && !col.isPrimaryKey) {
        def += ' NOT NULL';
      }
      
      if (col.defaultValue !== undefined && col.defaultValue !== null) {
        def += ` DEFAULT ${col.defaultValue}`;
      }
      
      if (col.isUnique && !col.isPrimaryKey) {
        def += ' UNIQUE';
      }
      
      return def;
    });

    const sql = `CREATE TABLE ${this.quoteIdentifier(table)} (${columnDefs.join(', ')})`;
    this.db.run(sql);
  }

  async dropTable(table: string, schema?: string, cascade?: boolean): Promise<void> {
    if (!this.db) {
      throw new Error('未连接到数据库');
    }

    this.db.run(`DROP TABLE ${cascade ? 'IF EXISTS ' : ''}${this.quoteIdentifier(table)}`);
  }

  async truncateTable(table: string, schema?: string): Promise<void> {
    if (!this.db) {
      throw new Error('未连接到数据库');
    }

    this.db.run(`DELETE FROM ${this.quoteIdentifier(table)}`);
    this.db.run(`DELETE FROM sqlite_sequence WHERE name='${table}'`);
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.db) {
      throw new Error('未连接到数据库');
    }

    const startTime = this.getCurrentTimestamp();
    
    try {
      const upperQuery = query.trim().toUpperCase();
      
      // 判断是否是查询语句
      if (upperQuery.startsWith('SELECT') || upperQuery.startsWith('PRAGMA') || upperQuery.startsWith('EXPLAIN')) {
        const result = this.db.exec(query);
        
        if (result.length === 0) {
          return {
            columns: [],
            rows: [],
            rowCount: 0,
            duration: this.getCurrentTimestamp() - startTime,
            success: true
          };
        }

        const columns = result[0].columns.map(col => ({
          name: col,
          type: 'TEXT'
        }));

        const rows = result[0].values.map(row => {
          const obj: Record<string, any> = {};
          columns.forEach((col, idx) => {
            obj[col.name] = row[idx];
          });
          return obj;
        });
        
        return this.processQueryResult(rows, columns, startTime);
      } else {
        // 写操作
        this.db.run(query);
        
        // 获取受影响的行数
        const changesResult = this.db.exec('SELECT changes() as changes');
        let affectedRows = 0;
        if (changesResult.length > 0) {
          const changesIdx = changesResult[0].columns.indexOf('changes');
          affectedRows = changesResult[0].values[0][changesIdx] as number;
        }
        
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          affectedRows,
          duration: this.getCurrentTimestamp() - startTime,
          success: true
        };
      }
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

  async explainQuery(query: string): Promise<QueryResult> {
    return this.executeQuery(`EXPLAIN QUERY PLAN ${query}`);
  }

  async insertData(table: string, data: Record<string, any>): Promise<void> {
    if (!this.db) {
      throw new Error('未连接到数据库');
    }

    const columns = Object.keys(data);
    const values = columns.map(col => data[col]);
    const placeholders = columns.map(() => '?').join(', ');

    const sql = `INSERT INTO ${this.quoteIdentifier(table)} (${columns.map(c => this.quoteIdentifier(c)).join(', ')}) VALUES (${placeholders})`;
    
    this.db.run(sql, values);
  }

  async updateData(table: string, data: Record<string, any>, where: string): Promise<void> {
    if (!this.db) {
      throw new Error('未连接到数据库');
    }

    const columns = Object.keys(data);
    const values = columns.map(col => data[col]);
    const setClause = columns.map(col => `${this.quoteIdentifier(col)} = ?`).join(', ');

    const sql = `UPDATE ${this.quoteIdentifier(table)} SET ${setClause} WHERE ${where}`;
    
    this.db.run(sql, values);
  }

  async deleteData(table: string, where: string): Promise<void> {
    if (!this.db) {
      throw new Error('未连接到数据库');
    }

    const sql = `DELETE FROM ${this.quoteIdentifier(table)} WHERE ${where}`;
    this.db.run(sql);
  }

  async exportTable(table: string, options: ExportOptions): Promise<string> {
    if (!this.db) {
      throw new Error('未连接到数据库');
    }

    const result = this.db.exec(`SELECT * FROM ${this.quoteIdentifier(table)}`);
    
    if (result.length === 0) {
      fs.writeFileSync(options.outputPath, '[]');
      return options.outputPath;
    }

    const columns = result[0].columns;
    const rows = result[0].values.map(row => {
      const obj: Record<string, any> = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
    
    if (options.format === 'json') {
      const json = JSON.stringify(rows, null, 2);
      fs.writeFileSync(options.outputPath, json);
      return options.outputPath;
    } else if (options.format === 'csv') {
      if (rows.length === 0) {
        fs.writeFileSync(options.outputPath, '');
        return options.outputPath;
      }

      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csv = [
        columns.join(','),
        ...rows.map(row => columns.map(col => escapeCsv(row[col])).join(','))
      ].join('\n');

      fs.writeFileSync(options.outputPath, csv);
      return options.outputPath;
    }

    throw new Error(`不支持的导出格式：${options.format}`);
  }

  async importTable(filePath: string, options: ImportOptions): Promise<void> {
    if (!this.db) {
      throw new Error('未连接到数据库');
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    if (options.format === 'json') {
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        for (const row of data) {
          await this.insertData(options.targetTable, row);
        }
      }
    } else if (options.format === 'csv') {
      const lines = content.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        for (let i = 1; i < lines.length; i++) {
          const values = this.parseCsvLine(lines[i]);
          const row: Record<string, any> = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx];
          });
          await this.insertData(options.targetTable, row);
        }
      }
    }
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  quoteValue(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }
}
