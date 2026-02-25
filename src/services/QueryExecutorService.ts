/**
 * 查询执行器服务
 * 提供增强的查询执行功能
 */

import * as vscode from 'vscode';
import type { IDatabaseService, QueryResult, DatabaseConnection } from '../types';

export interface ExecutionOptions {
  connectionId: string;
  query: string;
  database?: string;
  limit?: number;
  timeout?: number;
  readOnly?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  results: QueryResult[];
  duration: number;
  error?: string;
}

export class QueryExecutorService implements vscode.Disposable {
  private executingQueries: Map<string, boolean> = new Map();

  constructor(private connectionManager: any) {}

  dispose(): void {
    this.executingQueries.clear();
  }

  /**
   * 执行单个查询
   */
  async execute(options: ExecutionOptions): Promise<ExecutionResult> {
    const { connectionId, query, database, limit = 1000, timeout = 30000 } = options;

    // 检查是否正在执行
    if (this.executingQueries.get(connectionId)) {
      return {
        success: false,
        results: [],
        duration: 0,
        error: '当前连接已有查询在执行中'
      };
    }

    this.executingQueries.set(connectionId, true);
    const startTime = Date.now();

    try {
      // 获取服务
      const service: IDatabaseService = await this.connectionManager.getService(connectionId);
      
      // 验证查询
      if (options.readOnly && !this.isReadOnlyQuery(query)) {
        const confirm = await vscode.window.showWarningMessage(
          '此查询可能修改数据，确定要继续吗？',
          { modal: true },
          '继续'
        );
        
        if (confirm !== '继续') {
          return {
            success: false,
            results: [],
            duration: 0,
            error: '用户取消'
          };
        }
      }

      // 设置超时
      const timeoutPromise = new Promise<QueryResult>((_, reject) => {
        setTimeout(() => reject(new Error(`查询超时（${timeout}ms）`)), timeout);
      });

      // 执行查询
      const queryPromise = service.executeQuery(query);
      const result = await Promise.race([queryPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      this.executingQueries.set(connectionId, false);

      return {
        success: result.success,
        results: [result],
        duration,
        error: result.error
      };
    } catch (error: any) {
      this.executingQueries.set(connectionId, false);
      return {
        success: false,
        results: [],
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * 执行多个查询（批量）
   */
  async executeBatch(
    connectionId: string,
    queries: string[],
    options?: { stopOnError?: boolean }
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const stopOnError = options?.stopOnError ?? true;

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i].trim();
      if (!query) continue;

      const result = await this.execute({
        connectionId,
        query,
        limit: 1000,
        timeout: 30000
      });

      results.push(result);

      if (!result.success && stopOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * 执行并带进度显示
   */
  async executeWithProgress(options: ExecutionOptions): Promise<ExecutionResult> {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '执行查询中...',
        cancellable: false
      },
      async () => {
        return await this.execute(options);
      }
    );
  }

  /**
   * 检查查询是否为只读
   */
  isReadOnlyQuery(query: string): boolean {
    const upperQuery = query.trim().toUpperCase();
    const writeKeywords = [
      'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 
      'ALTER', 'TRUNCATE', 'REPLACE', 'MERGE'
    ];
    return !writeKeywords.some(keyword => upperQuery.startsWith(keyword));
  }

  /**
   * 解析多个 SQL 语句
   */
  parseQueries(sql: string): string[] {
    const queries: string[] = [];
    let currentQuery = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const prevChar = sql[i - 1];

      // 处理字符串
      if ((char === "'" || char === '"') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      // 处理分号
      if (char === ';' && !inString) {
        const trimmed = currentQuery.trim();
        if (trimmed) {
          queries.push(trimmed);
        }
        currentQuery = '';
      } else {
        currentQuery += char;
      }
    }

    // 处理最后一个查询
    const trimmed = currentQuery.trim();
    if (trimmed) {
      queries.push(trimmed);
    }

    return queries;
  }

  /**
   * 格式化查询结果
   */
  formatResult(result: QueryResult, format: 'table' | 'json' | 'csv'): string {
    if (!result.rows || result.rows.length === 0) {
      return '无结果';
    }

    if (format === 'json') {
      return JSON.stringify(result.rows, null, 2);
    }

    if (format === 'csv') {
      const columns = result.columns.map(c => c.name);
      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        columns.join(','),
        ...result.rows.map(row =>
          columns.map(col => escapeCsv(row[col])).join(',')
        )
      ].join('\n');
    }

    // 表格格式
    return '表格格式（在 Webview 中显示）';
  }

  /**
   * 取消正在执行的查询
   */
  cancel(connectionId: string): void {
    this.executingQueries.set(connectionId, false);
  }

  /**
   * 检查连接是否正在执行查询
   */
  isExecuting(connectionId: string): boolean {
    return this.executingQueries.get(connectionId) || false;
  }
}
