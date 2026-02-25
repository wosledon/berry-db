/**
 * SQL 语言服务提供者
 * 提供智能提示、悬停提示、定义跳转等功能
 */

import * as vscode from 'vscode';
import { DatabaseObjectCacheService, DatabaseObject } from './DatabaseObjectCacheService';
import { ConnectionManager } from './ConnectionManager';

export class SqlLanguageProvider implements vscode.Disposable {
  private completionProvider: SqlCompletionProvider;
  private hoverProvider: SqlHoverProvider;
  private signatureHelpProvider: SqlSignatureHelpProvider;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private cacheService: DatabaseObjectCacheService,
    private connectionManager: ConnectionManager
  ) {
    this.completionProvider = new SqlCompletionProvider(cacheService);
    this.hoverProvider = new SqlHoverProvider(cacheService);
    this.signatureHelpProvider = new SqlSignatureHelpProvider();

    // 注册提供者
    this.disposables.push(
      vscode.languages.registerCompletionItemProvider(
        'sql',
        this.completionProvider,
        '.', ' ', '(', ',', '\n', 'SELECT', 'FROM', 'WHERE', 'JOIN', 'INSERT', 'UPDATE', 'DELETE'
      ),
      vscode.languages.registerHoverProvider('sql', this.hoverProvider),
      vscode.languages.registerSignatureHelpProvider(
        'sql',
        this.signatureHelpProvider,
        '(', ','
      )
    );
  }

  /**
   * 刷新指定连接的缓存
   */
  async refreshConnection(connectionId: string): Promise<void> {
    await this.cacheService.refreshCache(connectionId);
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.cacheService.dispose();
  }
}

/**
 * SQL 补全提供者
 */
class SqlCompletionProvider implements vscode.CompletionItemProvider {
  // SQL 关键字
  private static readonly KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS NULL', 'IS NOT NULL',
    'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET', 'ASC', 'DESC',
    'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN', 'ON',
    'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
    'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'TRUNCATE TABLE',
    'CREATE INDEX', 'DROP INDEX', 'CREATE VIEW', 'DROP VIEW',
    'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'UNIQUE', 'DEFAULT',
    'AUTO_INCREMENT', 'NOT NULL', 'NULL', 'CASCADE', 'RESTRICT',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'CEIL', 'FLOOR',
    'COALESCE', 'NULLIF', 'CAST', 'CONVERT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'EXISTS', 'ANY', 'ALL', 'UNION', 'INTERSECT', 'EXCEPT',
    'DISTINCT', 'AS', 'WITH', 'RECURSIVE'
  ];

  // SQL 函数
  private static readonly FUNCTIONS = [
    { name: 'COUNT()', detail: '统计行数' },
    { name: 'SUM()', detail: '求和' },
    { name: 'AVG()', detail: '平均值' },
    { name: 'MIN()', detail: '最小值' },
    { name: 'MAX()', detail: '最大值' },
    { name: 'ROUND()', detail: '四舍五入' },
    { name: 'CEIL()', detail: '向上取整' },
    { name: 'FLOOR()', detail: '向下取整' },
    { name: 'ABS()', detail: '绝对值' },
    { name: 'LENGTH()', detail: '字符串长度' },
    { name: 'SUBSTRING()', detail: '子字符串' },
    { name: 'TRIM()', detail: '去除空格' },
    { name: 'UPPER()', detail: '转大写' },
    { name: 'LOWER()', detail: '转小写' },
    { name: 'REPLACE()', detail: '替换字符串' },
    { name: 'CONCAT()', detail: '连接字符串' },
    { name: 'NOW()', detail: '当前时间' },
    { name: 'CURRENT_DATE', detail: '当前日期' },
    { name: 'CURRENT_TIME', detail: '当前时间' },
    { name: 'CURRENT_TIMESTAMP', detail: '当前时间戳' },
    { name: 'DATE_FORMAT()', detail: '日期格式化' },
    { name: 'COALESCE()', detail: '返回第一个非空值' },
    { name: 'NULLIF()', detail: '相等返回 NULL' }
  ];

  constructor(private cacheService: DatabaseObjectCacheService) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[]> {
    const items: vscode.CompletionItem[] = [];
    const linePrefix = document.lineAt(position).text.substring(0, position.character);
    const wordRange = document.getWordRangeAtPosition(position);
    const word = wordRange ? document.getText(wordRange) : '';

    // 获取当前连接（从活动编辑器）
    const connectionId = this.getActiveConnectionId();

    // 1. SQL 关键字补全
    if (word.length > 0) {
      const upperWord = word.toUpperCase();
      SqlCompletionProvider.KEYWORDS.forEach(keyword => {
        if (keyword.includes(upperWord)) {
          const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
          item.detail = 'SQL 关键字';
          item.insertText = keyword;
          items.push(item);
        }
      });
    }

    // 2. SQL 函数补全
    SqlCompletionProvider.FUNCTIONS.forEach(func => {
      if (!word || func.name.toLowerCase().includes(word.toLowerCase())) {
        const item = new vscode.CompletionItem(func.name.replace('()', ''), vscode.CompletionItemKind.Function);
        item.detail = func.detail;
        if (func.name.includes('()')) {
          item.insertText = new vscode.SnippetString(`${func.name.replace('()', '')}($1)`);
        }
        items.push(item);
      }
    });

    // 3. 数据库对象补全
    if (connectionId && this.cacheService.hasCache(connectionId)) {
      // 数据库补全
      const databases = this.cacheService.getDatabases(connectionId);
      databases.forEach(db => {
        if (!word || db.name.toLowerCase().includes(word.toLowerCase())) {
          const item = new vscode.CompletionItem(db.name, vscode.CompletionItemKind.Struct);
          item.detail = '数据库';
          item.insertText = db.name;
          items.push(item);
        }
      });

      // 表补全
      const tables = this.cacheService.getTables(connectionId);
      tables.forEach(table => {
        if (!word || table.name.toLowerCase().includes(word.toLowerCase())) {
          const item = new vscode.CompletionItem(table.name, vscode.CompletionItemKind.Class);
          item.detail = '表';
          item.insertText = table.name;
          items.push(item);
        }
      });

      // 列补全（检测上下文中的表名）
      const tableName = this.extractTableName(document, position);
      if (tableName) {
        const columns = this.cacheService.getColumns(connectionId, tableName);
        columns.forEach(col => {
          if (!word || col.name.toLowerCase().includes(word.toLowerCase())) {
            const item = new vscode.CompletionItem(col.name, vscode.CompletionItemKind.Field);
            item.detail = `${col.dataType || '列'} - ${tableName}`;
            if (col.description) {
              item.documentation = col.description;
            }
            item.insertText = col.name;
            items.push(item);
          }
        });
      }
    }

    return items;
  }

  /**
   * 从上下文中提取表名
   */
  private extractTableName(document: vscode.TextDocument, position: vscode.Position): string | null {
    const text = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
    const lines = text.split('\n');
    
    // 查找最近的 FROM 或 JOIN 子句
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim().toUpperCase();
      
      // FROM table
      const fromMatch = line.match(/FROM\s+([A-Za-z_][A-Za-z0-9_]*)/i);
      if (fromMatch) {
        return fromMatch[1];
      }
      
      // JOIN table
      const joinMatch = line.match(/JOIN\s+([A-Za-z_][A-Za-z0-9_]*)/i);
      if (joinMatch) {
        return joinMatch[1];
      }
      
      // UPDATE table
      const updateMatch = line.match(/UPDATE\s+([A-Za-z_][A-Za-z0-9_]*)/i);
      if (updateMatch) {
        return updateMatch[1];
      }
      
      // INSERT INTO table
      const insertMatch = line.match(/INSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)/i);
      if (insertMatch) {
        return insertMatch[1];
      }
    }
    
    return null;
  }

  /**
   * 获取活动连接 ID
   */
  private getActiveConnectionId(): string | null {
    // 这里可以从状态栏管理器或配置中获取
    // 简化实现：返回 null，表示不显示特定连接的对象
    return null;
  }
}

/**
 * SQL 悬停提示提供者
 */
class SqlHoverProvider implements vscode.HoverProvider {
  constructor(private cacheService: DatabaseObjectCacheService) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) return null;

    const word = document.getText(wordRange);
    const connectionId = this.getActiveConnectionId();

    if (!connectionId || !this.cacheService.hasCache(connectionId)) {
      return null;
    }

    // 查找表信息
    const tables = this.cacheService.getTables(connectionId);
    const table = tables.find(t => t.name.toLowerCase() === word.toLowerCase());
    
    if (table) {
      const columns = this.cacheService.getColumns(connectionId, table.name);
      const markdown = new vscode.MarkdownString();
      markdown.appendCodeblock(`📋 ${table.name}`, 'markdown');
      markdown.appendMarkdown('\n\n**列**:\n');
      columns.forEach(col => {
        markdown.appendMarkdown(`- \`${col.name}\` ${col.dataType || ''}\n`);
      });
      return new vscode.Hover(markdown);
    }

    // 查找列信息
    const allColumns = this.cacheService.searchObjects(connectionId, word, 'column');
    if (allColumns.length > 0) {
      const col = allColumns[0];
      const markdown = new vscode.MarkdownString();
      markdown.appendCodeblock(`📝 ${col.name}`, 'markdown');
      markdown.appendMarkdown(`\n\n**类型**: ${col.dataType || '未知'}\n`);
      markdown.appendMarkdown(`**表**: ${col.parent || '未知'}\n`);
      if (col.description) {
        markdown.appendMarkdown(`\n${col.description}\n`);
      }
      return new vscode.Hover(markdown);
    }

    return null;
  }

  private getActiveConnectionId(): string | null {
    return null;
  }
}

/**
 * SQL 签名帮助提供者
 */
class SqlSignatureHelpProvider implements vscode.SignatureHelpProvider {
  private static readonly SIGNATURES: Record<string, { label: string; parameters: string[]; documentation: string }> = {
    'COUNT': {
      label: 'COUNT(expression)',
      parameters: ['expression'],
      documentation: '统计行数或满足条件的记录数'
    },
    'SUM': {
      label: 'SUM(expression)',
      parameters: ['expression'],
      documentation: '计算数值列的总和'
    },
    'AVG': {
      label: 'AVG(expression)',
      parameters: ['expression'],
      documentation: '计算数值列的平均值'
    },
    'ROUND': {
      label: 'ROUND(number, decimals)',
      parameters: ['number', 'decimals'],
      documentation: '四舍五入到指定小数位'
    },
    'SUBSTRING': {
      label: 'SUBSTRING(string, start, length)',
      parameters: ['string', 'start', 'length'],
      documentation: '提取子字符串'
    },
    'CONCAT': {
      label: 'CONCAT(string1, string2, ...)',
      parameters: ['string1', 'string2', '...'],
      documentation: '连接多个字符串'
    },
    'COALESCE': {
      label: 'COALESCE(value1, value2, ...)',
      parameters: ['value1', 'value2', '...'],
      documentation: '返回第一个非 NULL 值'
    },
    'NULLIF': {
      label: 'NULLIF(expression1, expression2)',
      parameters: ['expression1', 'expression2'],
      documentation: '如果两个表达式相等则返回 NULL'
    },
    'DATE_FORMAT': {
      label: 'DATE_FORMAT(date, format)',
      parameters: ['date', 'format'],
      documentation: '格式化日期'
    },
    'REPLACE': {
      label: 'REPLACE(string, search, replace)',
      parameters: ['string', 'search', 'replace'],
      documentation: '替换字符串中的子串'
    }
  };

  async provideSignatureHelp(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.SignatureHelpContext
  ): Promise<vscode.SignatureHelp | null> {
    const wordRange = document.getWordRangeAtPosition(position.translate(0, -1));
    if (!wordRange) return null;

    const word = document.getText(wordRange).toUpperCase();
    const signature = SqlSignatureHelpProvider.SIGNATURES[word];

    if (!signature) return null;

    const signatureHelp = new vscode.SignatureHelp();
    const signatureInfo = new vscode.SignatureInformation(signature.label);
    signatureInfo.documentation = signature.documentation;
    signatureInfo.parameters = signature.parameters.map(
      p => new vscode.ParameterInformation(p)
    );
    signatureHelp.signatures = [signatureInfo];
    signatureHelp.activeSignature = 0;
    signatureHelp.activeParameter = this.getActiveParameter(document, position);

    return signatureHelp;
  }

  private getActiveParameter(document: vscode.TextDocument, position: vscode.Position): number {
    const line = document.lineAt(position).text;
    const parenStart = line.lastIndexOf('(', position.character);
    if (parenStart === -1) return 0;

    const content = line.substring(parenStart + 1, position.character);
    const commaCount = content.split(',').length - 1;
    return Math.max(0, commaCount);
  }
}
