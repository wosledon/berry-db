/**
 * PostgreSQL 数据库服务实现
 */

import pg from 'pg';
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

const { Client } = pg;

export class PostgresService extends DatabaseService {
  private client?: pg.Client;

  constructor(connection: DatabaseConnection) {
    super(connection);
  }

  getDatabaseType(): string {
    return 'PostgreSQL';
  }

  async connect(): Promise<void> {
    const config: pg.ClientConfig = {
      host: this.connection.host,
      port: this.connection.port || 5432,
      database: this.connection.database || 'postgres',
      user: this.connection.username,
      password: this.connection.password,
      connectionTimeoutMillis: this.connection.connectionTimeout || 10000,
      ssl: this.connection.ssl ? { rejectUnauthorized: false } : false
    };

    this.client = new Client(config);
    await this.client.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = undefined;
      this.connected = false;
    }
  }

  async getDatabases(): Promise<string[]> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const result = await this.client.query(
      "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname"
    );

    return result.rows.map(row => row.datname);
  }

  async getSchemas(): Promise<string[]> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const result = await this.client.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema') ORDER BY schema_name"
    );

    return result.rows.map(row => row.schema_name);
  }

  async getTables(database?: string, schema?: string): Promise<TableInfo[]> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const targetSchema = schema || 'public';
    
    const result = await this.client.query(
      `SELECT 
        tablename as name,
        schemaname as schema
       FROM pg_tables 
       WHERE schemaname = $1 
       ORDER BY tablename`,
      [targetSchema]
    );

    const tables: TableInfo[] = [];
    for (const row of result.rows) {
      const countResult = await this.client.query(
        `SELECT COUNT(*) as count FROM ${this.quoteIdentifier(targetSchema)}.${this.quoteIdentifier(row.name)}`
      );
      
      tables.push({
        name: row.name,
        schema: row.schema,
        type: 'table',
        rowCount: parseInt(countResult.rows[0].count)
      });
    }

    return tables;
  }

  async getTableDetail(table: string, schema?: string): Promise<TableDetail> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const targetSchema = schema || 'public';
    const columns: ColumnInfo[] = [];
    const indexes: IndexInfo[] = [];
    const foreignKeys: ForeignKeyInfo[] = [];

    // 获取列信息
    const columnsResult = await this.client.query(
      `SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        ordinal_position,
        character_maximum_length,
        numeric_precision,
        numeric_scale
       FROM information_schema.columns 
       WHERE table_schema = $1 AND table_name = $2 
       ORDER BY ordinal_position`,
      [targetSchema, table]
    );

    // 获取主键信息
    const pkResult = await this.client.query(
      `SELECT a.attname
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = $1::regclass AND i.indisprimary`,
      [`${targetSchema}.${table}`]
    );
    const pkColumns = pkResult.rows.map(r => r.attname);

    // 获取唯一约束列
    const uniqueResult = await this.client.query(
      `SELECT a.attname
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = $1::regclass AND i.indisunique AND NOT i.indisprimary`,
      [`${targetSchema}.${table}`]
    );
    const uniqueColumns = uniqueResult.rows.map(r => r.attname);

    for (const row of columnsResult.rows) {
      const dataType = this.buildPostgresType(row);
      
      columns.push({
        name: row.column_name,
        type: dataType,
        nullable: row.is_nullable === 'YES',
        defaultValue: row.column_default,
        isPrimaryKey: pkColumns.includes(row.column_name),
        isAutoIncrement: row.column_default?.includes('nextval') || false,
        isUnique: uniqueColumns.includes(row.column_name),
        ordinalPosition: row.ordinal_position
      });
    }

    // 获取索引信息
    const indexesResult = await this.client.query(
      `SELECT 
        indexname,
        indexdef
       FROM pg_indexes 
       WHERE schemaname = $1 AND tablename = $2`,
      [targetSchema, table]
    );

    for (const row of indexesResult.rows) {
      const isPrimary = row.indexname.startsWith(`${table}_pkey`);
      const isUnique = row.indexdef.includes('UNIQUE');
      
      // 解析索引列
      const match = row.indexdef.match(/\(([^)]+)\)/);
      const indexColumns = match ? match[1].split(',').map(c => c.trim().replace(/"/g, '')) : [];

      if (!isPrimary) {
        indexes.push({
          name: row.indexname,
          columns: indexColumns,
          isUnique,
          isPrimary: false,
          type: 'BTREE'
        });
      }
    }

    // 获取外键信息
    const fkResult = await this.client.query(
      `SELECT
        conname as constraint_name,
        conrelid::regclass as table_name,
        a.attname as column_name,
        cf.relname as ref_table,
        af.attname as ref_column,
        confdeltype as on_delete,
        confupdtype as on_update
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       JOIN pg_class cf ON cf.oid = c.confrelid
       JOIN pg_attribute af ON af.attrelid = cf.oid AND af.attnum = ANY(c.confkey)
       WHERE c.contype = 'f' AND c.conrelid = $1::regclass`,
      [`${targetSchema}.${table}`]
    );

    const fkMap = new Map<string, ForeignKeyInfo>();
    for (const row of fkResult.rows) {
      if (!fkMap.has(row.constraint_name)) {
        fkMap.set(row.constraint_name, {
          name: row.constraint_name,
          columns: [],
          referencedTable: row.ref_table,
          referencedColumns: [],
          onDelete: this.mapForeignKeyAction(row.on_delete),
          onUpdate: this.mapForeignKeyAction(row.on_update)
        });
      }
      const fk = fkMap.get(row.constraint_name)!;
      fk.columns.push(row.column_name);
      fk.referencedColumns.push(row.ref_column);
    }

    return {
      table: {
        name: table,
        schema: targetSchema,
        type: 'table'
      },
      columns,
      indexes,
      foreignKeys: Array.from(fkMap.values())
    };
  }

  private buildPostgresType(row: any): string {
    let type = row.data_type.toUpperCase();
    
    if (type === 'CHARACTER VARYING' || type === 'CHARACTER') {
      type = `VARCHAR(${row.character_maximum_length || 255})`;
    } else if (type === 'NUMERIC') {
      type = `NUMERIC(${row.numeric_precision || 10},${row.numeric_scale || 0})`;
    } else if (type === 'USER-DEFINED') {
      type = row.udt_name || 'UNKNOWN';
    }
    
    return type;
  }

  private mapForeignKeyAction(action: string): string {
    const map: Record<string, string> = {
      'a': 'NO ACTION',
      'r': 'RESTRICT',
      'c': 'CASCADE',
      'n': 'SET NULL',
      'd': 'SET DEFAULT'
    };
    return map[action] || 'NO ACTION';
  }

  async createTable(table: string, columns: ColumnInfo[]): Promise<void> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const columnDefs = columns.map(col => {
      let def = `${this.quoteIdentifier(col.name)} ${col.type}`;
      
      if (col.isPrimaryKey) {
        def += ' PRIMARY KEY';
        if (col.isAutoIncrement) {
          def = `${this.quoteIdentifier(col.name)} SERIAL PRIMARY KEY`;
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
    await this.client.query(sql);
  }

  async dropTable(table: string, schema?: string, cascade?: boolean): Promise<void> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const targetSchema = schema || 'public';
    const sql = `DROP TABLE ${cascade ? 'CASCADE' : ''} ${this.quoteIdentifier(targetSchema)}.${this.quoteIdentifier(table)}`;
    await this.client.query(sql);
  }

  async truncateTable(table: string, schema?: string): Promise<void> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const targetSchema = schema || 'public';
    await this.client.query(`TRUNCATE TABLE ${this.quoteIdentifier(targetSchema)}.${this.quoteIdentifier(table)}`);
  }

  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const startTime = this.getCurrentTimestamp();
    
    try {
      const result = await this.client.query(query);
      
      return {
        columns: result.fields.map(f => ({
          name: f.name,
          type: this.postgresTypeToDisplay(f.dataTypeID),
          nullable: true
        })),
        rows: result.rows,
        rowCount: result.rowCount || 0,
        affectedRows: result.rowCount || 0,
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

  private postgresTypeToDisplay(typeId: number): string {
    const typeMap: Record<number, string> = {
      16: 'BOOLEAN',
      17: 'BYTEA',
      20: 'BIGINT',
      21: 'SMALLINT',
      23: 'INTEGER',
      25: 'TEXT',
      700: 'REAL',
      701: 'DOUBLE PRECISION',
      1082: 'DATE',
      1114: 'TIMESTAMP',
      1184: 'TIMESTAMPTZ',
      1700: 'NUMERIC'
    };
    return typeMap[typeId] || 'UNKNOWN';
  }

  async explainQuery(query: string): Promise<QueryResult> {
    return this.executeQuery(`EXPLAIN (ANALYZE, BUFFERS) ${query}`);
  }

  async insertData(table: string, data: Record<string, any>): Promise<void> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const columns = Object.keys(data);
    const values = columns.map((_, i) => `$${i + 1}`);
    
    const sql = `INSERT INTO ${this.quoteIdentifier(table)} (${columns.map(c => this.quoteIdentifier(c)).join(', ')}) VALUES (${values.join(', ')})`;
    
    const valuesArray = columns.map(col => data[col]);
    await this.client.query(sql, valuesArray);
  }

  async updateData(table: string, data: Record<string, any>, where: string): Promise<void> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const columns = Object.keys(data);
    const setClause = columns.map((col, i) => `${this.quoteIdentifier(col)} = $${i + 1}`).join(', ');

    const sql = `UPDATE ${this.quoteIdentifier(table)} SET ${setClause} WHERE ${where}`;
    const valuesArray = columns.map(col => data[col]);
    
    await this.client.query(sql, valuesArray);
  }

  async deleteData(table: string, where: string): Promise<void> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const sql = `DELETE FROM ${this.quoteIdentifier(table)} WHERE ${where}`;
    await this.client.query(sql);
  }

  async exportTable(table: string, options: ExportOptions): Promise<string> {
    if (!this.client) {
      throw new Error('未连接到数据库');
    }

    const result = await this.client.query(`SELECT * FROM ${this.quoteIdentifier(table)}`);
    
    if (options.format === 'json') {
      const json = JSON.stringify(result.rows, null, 2);
      fs.writeFileSync(options.outputPath, json);
      return options.outputPath;
    } else if (options.format === 'csv') {
      if (result.rows.length === 0) {
        fs.writeFileSync(options.outputPath, '');
        return options.outputPath;
      }

      const columns = Object.keys(result.rows[0]);
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
        ...result.rows.map(row => columns.map(col => escapeCsv(row[col])).join(','))
      ].join('\n');

      fs.writeFileSync(options.outputPath, csv);
      return options.outputPath;
    }

    throw new Error(`不支持的导出格式：${options.format}`);
  }

  async importTable(filePath: string, options: ImportOptions): Promise<void> {
    if (!this.client) {
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
