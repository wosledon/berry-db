/**
 * MySQL 数据库服务实现
 */

import mysql, { ConnectionOptions } from 'mysql2/promise';
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
import * as fs from 'fs';

export class MySqlService extends DatabaseService {
  private conn?: mysql.Connection;

  constructor(connection: DatabaseConnection) {
    super(connection);
  }

  getDatabaseType(): string {
    return 'MySQL';
  }

  async connect(): Promise<void> {
    const config: ConnectionOptions = {
      host: this.connection.host,
      port: this.connection.port || 3306,
      database: this.connection.database || '',
      user: this.connection.username,
      password: this.connection.password,
      connectTimeout: this.connection.connectionTimeout || 10000,
      ssl: this.connection.ssl ? {} : undefined,
      multipleStatements: true
    };

    this.conn = await mysql.createConnection(config);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.conn) {
      await this.conn.end();
      this.conn = undefined;
      this.connected = false;
    }
  }

  async getDatabases(): Promise<string[]> {
    if (!this.conn) {
      throw new Error('未连接到数据库');
    }

    const [rows] = await this.conn.query(
      "SELECT SCHEMA_NAME as name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys') ORDER BY SCHEMA_NAME"
    );

    return (rows as any[]).map(row => row.name);
  }

  async getSchemas(): Promise<string[]> {
    return this.getDatabases();
  }

  async getTables(database?: string, _schema?: string): Promise<TableInfo[]> {
    if (!this.conn) {
      throw new Error('未连接到数据库');
    }

    const targetDb = database || this.conn.config.database || '';

    const [rows] = await this.conn.query(
      `SELECT 
        TABLE_NAME as name,
        TABLE_SCHEMA as schema,
        TABLE_ROWS as row_count,
        TABLE_COMMENT as comment
       FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [targetDb]
    );

    return (rows as any[]).map(row => ({
      name: row.name,
      schema: row.schema,
      type: 'table',
      rowCount: row.row_count,
      description: row.comment
    }));
  }

  async getTableDetail(table: string, schema?: string): Promise<TableDetail> {
    if (!this.conn) {
      throw new Error('未连接到数据库');
    }

    const targetDb = schema || this.conn.config.database || '';
    const columns: ColumnInfo[] = [];
    const indexes: IndexInfo[] = [];
    const foreignKeys: ForeignKeyInfo[] = [];

    const [columnsRows] = await this.conn.query(
      `SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        COLUMN_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        COLUMN_KEY,
        EXTRA,
        ORDINAL_POSITION,
        COLUMN_COMMENT
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
       ORDER BY ORDINAL_POSITION`,
      [targetDb, table]
    );

    for (const row of columnsRows as any[]) {
      columns.push({
        name: row.COLUMN_NAME,
        type: row.COLUMN_TYPE,
        nullable: row.IS_NULLABLE === 'YES',
        defaultValue: row.COLUMN_DEFAULT,
        isPrimaryKey: row.COLUMN_KEY === 'PRI',
        isAutoIncrement: row.EXTRA.includes('auto_increment'),
        isUnique: row.COLUMN_KEY === 'UNI',
        comment: row.COLUMN_COMMENT,
        ordinalPosition: row.ORDINAL_POSITION
      });
    }

    const [indexesRows] = await this.conn.query(
      `SHOW INDEX FROM \`${table}\``
    );

    const indexMap = new Map<string, IndexInfo>();
    for (const row of indexesRows as any[]) {
      if (!indexMap.has(row.Key_name)) {
        indexMap.set(row.Key_name, {
          name: row.Key_name,
          columns: [],
          isUnique: row.Non_unique === 0,
          isPrimary: row.Key_name === 'PRIMARY',
          type: row.Index_type
        });
      }
      const index = indexMap.get(row.Key_name)!;
      index.columns.push(row.Column_name);
    }

    const [fkRows] = await this.conn.query(
      `SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME,
        DELETE_RULE,
        UPDATE_RULE
       FROM information_schema.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [targetDb, table]
    );

    const fkMap = new Map<string, ForeignKeyInfo>();
    for (const row of fkRows as any[]) {
      if (!fkMap.has(row.CONSTRAINT_NAME)) {
        fkMap.set(row.CONSTRAINT_NAME, {
          name: row.CONSTRAINT_NAME,
          columns: [],
          referencedTable: row.REFERENCED_TABLE_NAME,
          referencedColumns: [],
          onDelete: row.DELETE_RULE,
          onUpdate: row.UPDATE_RULE
        });
      }
      const fk = fkMap.get(row.CONSTRAINT_NAME)!;
      fk.columns.push(row.COLUMN_NAME);
      fk.referencedColumns.push(row.REFERENCED_COLUMN_NAME);
    }

    return {
      table: {
        name: table,
        schema: targetDb,
        type: 'table'
      },
      columns,
      indexes: Array.from(indexMap.values()),
      foreignKeys: Array.from(fkMap.values())
    };
  }

  async createTable(table: string, columns: ColumnInfo[]): Promise<void> {
    if (!this.conn) {
      throw new Error('未连接到数据库');
    }

    const columnDefs = columns.map(col => {
      let def = `\`${col.name}\` ${col.type}`;
      
      if (col.isPrimaryKey) {
        def += ' PRIMARY KEY';
        if (col.isAutoIncrement) {
          def = `\`${col.name}\` INT AUTO_INCREMENT PRIMARY KEY`;
        }
      }
      
      if (!col.nullable && !col.isPrimaryKey) {
        def += ' NOT NULL';
      }
      
      if (col.defaultValue !== undefined && col.defaultValue !== null) {
        if (typeof col.defaultValue === 'string' && !col.defaultValue.toUpperCase().startsWith('CURRENT_')) {
          def += ` DEFAULT '${col.defaultValue}'`;
        } else {
          def += ` DEFAULT ${col.defaultValue}`;
        }
      }
      
      if (col.isUnique && !col.isPrimaryKey) {
        def += ' UNIQUE';
      }
      
      if (col.comment) {
        def += ` COMMENT '${col.comment}'`;
      }
      
      return def;
    });

    const sql = `CREATE TABLE \`${table}\` (${columnDefs.join(', ')})`;
    await this.conn.query(sql);
  }

  async dropTable(table: string, _schema?: string, _cascade?: boolean): Promise<void> {
    if (!this.conn) {
      throw new Error('未连接到数据库');
    }

    const sql = `DROP TABLE \`${table}\``;
    await this.conn.query(sql);
  }

  async truncateTable(table: string, _schema?: string): Promise<void> {
    if (!this.conn) {
      throw new Error('未连接到数据库');
    }

    await this.conn.query(`TRUNCATE TABLE \`${table}\``);
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.conn) {
      throw new Error('未连接到数据库');
    }

    const startTime = this.getCurrentTimestamp();
    
    try {
      const [rows, fields] = await this.conn.query(query);
      
      if (Array.isArray(fields) && fields.length > 0) {
        return {
          columns: (fields as mysql.FieldPacket[]).map(f => ({
            name: f.name,
            type: this.mysqlTypeToDisplay(f.type),
            nullable: true
          })),
          rows: rows as any[],
          rowCount: (rows as any[]).length,
          duration: this.getCurrentTimestamp() - startTime,
          success: true
        };
      } else {
        const result = rows as mysql.ResultSetHeader;
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          affectedRows: result.affectedRows,
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

  private mysqlTypeToDisplay(type: number): string {
    const typeMap: Record<number, string> = {
      1: 'TINYINT',
      2: 'SMALLINT',
      3: 'INT',
      4: 'FLOAT',
      5: 'DOUBLE',
      7: 'TIMESTAMP',
      8: 'BIGINT',
      9: 'MEDIUMINT',
      10: 'DATE',
      11: 'TIME',
      12: 'DATETIME',
      13: 'YEAR',
      14: 'DATE',
      15: 'VARCHAR',
      246: 'DECIMAL',
      252: 'TEXT',
      253: 'VARCHAR',
      254: 'CHAR'
    };
    return typeMap[type] || 'UNKNOWN';
  }

  async explainQuery(query: string): Promise<QueryResult> {
    return this.executeQuery(`EXPLAIN ${query}`);
  }

  async insertData(table: string, data: Record<string, any>): Promise<void> {
    if (!this.conn) {
      throw new Error('未连接到数据库');
    }

    const columns = Object.keys(data);
    const values = columns.map(() => '?').join(', ');
    
    const sql = `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${values})`;
    const valuesArray = columns.map(col => data[col]);
    
    await this.conn.execute(sql, valuesArray);
  }

  async updateData(table: string, data: Record<string, any>, where: string): Promise<void> {
    if (!this.conn) {
      throw new Error('未连接到数据库');
    }

    const columns = Object.keys(data);
    const setClause = columns.map(col => `\`${col}\` = ?`).join(', ');

    const sql = `UPDATE \`${table}\` SET ${setClause} WHERE ${where}`;
    const valuesArray = columns.map(col => data[col]);
    
    await this.conn.execute(sql, valuesArray);
  }

  async deleteData(table: string, where: string): Promise<void> {
    if (!this.conn) {
      throw new Error('未连接到数据库');
    }

    const sql = `DELETE FROM \`${table}\` WHERE ${where}`;
    await this.conn.query(sql);
  }

  async exportTable(table: string, options: ExportOptions): Promise<string> {
    if (!this.conn) {
      throw new Error('未连接到数据库');
    }

    const [rows] = await this.conn.query(`SELECT * FROM \`${table}\``);
    
    if (options.format === 'json') {
      const json = JSON.stringify(rows, null, 2);
      fs.writeFileSync(options.outputPath, json);
      return options.outputPath;
    } else if (options.format === 'csv') {
      const data = rows as any[];
      if (data.length === 0) {
        fs.writeFileSync(options.outputPath, '');
        return options.outputPath;
      }

      const columns = Object.keys(data[0]);
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
        ...data.map(row => columns.map(col => escapeCsv(row[col])).join(','))
      ].join('\n');

      fs.writeFileSync(options.outputPath, csv);
      return options.outputPath;
    } else if (options.format === 'sql') {
      const data = rows as any[];
      let sql = '';
      
      const [createRows] = await this.conn.query(`SHOW CREATE TABLE \`${table}\``);
      sql += (createRows as any[])[0]['Create Table'] + ';\n\n';
      
      for (const row of data) {
        const columns = Object.keys(row);
        const values = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number' || typeof val === 'boolean') return String(val);
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        sql += `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${values.join(', ')});\n`;
      }
      
      fs.writeFileSync(options.outputPath, sql);
      return options.outputPath;
    }

    throw new Error(`不支持的导出格式：${options.format}`);
  }

  async importTable(filePath: string, options: ImportOptions): Promise<void> {
    if (!this.conn) {
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
    } else if (options.format === 'sql') {
      await this.conn.query(content);
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
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  quoteValue(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }
}
