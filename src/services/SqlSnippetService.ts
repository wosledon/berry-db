/**
 * SQL 片段服务
 * 提供常用 SQL 模板和快捷片段
 */

import * as vscode from 'vscode';

export interface SqlSnippet {
  id: string;
  name: string;
  description: string;
  template: string;
  category: 'common' | 'select' | 'insert' | 'update' | 'delete' | 'ddl' | 'custom';
  variables?: string[];
}

export class SqlSnippetService implements vscode.Disposable {
  private static readonly DEFAULT_SNIPPETS: SqlSnippet[] = [
    // 常用查询
    {
      id: 'select-all',
      name: 'SELECT *',
      description: '查询所有记录',
      template: 'SELECT * FROM ${table} LIMIT ${limit};',
      category: 'select',
      variables: ['table', 'limit']
    },
    {
      id: 'select-count',
      name: 'COUNT(*)',
      description: '统计记录数',
      template: 'SELECT COUNT(*) FROM ${table};',
      category: 'select',
      variables: ['table']
    },
    {
      id: 'select-where',
      name: 'SELECT WHERE',
      description: '条件查询',
      template: 'SELECT * FROM ${table} WHERE ${column} = ${value};',
      category: 'select',
      variables: ['table', 'column', 'value']
    },
    {
      id: 'select-order',
      name: 'SELECT ORDER BY',
      description: '排序查询',
      template: 'SELECT * FROM ${table} ORDER BY ${column} ${order};',
      category: 'select',
      variables: ['table', 'column', 'order']
    },
    {
      id: 'select-group',
      name: 'SELECT GROUP BY',
      description: '分组查询',
      template: 'SELECT ${column}, COUNT(*) FROM ${table} GROUP BY ${column};',
      category: 'select',
      variables: ['table', 'column']
    },
    {
      id: 'select-join',
      name: 'SELECT JOIN',
      description: '连接查询',
      template: 'SELECT * FROM ${table1} JOIN ${table2} ON ${table1}.${column} = ${table2}.${column};',
      category: 'select',
      variables: ['table1', 'table2', 'column']
    },
    
    // 插入
    {
      id: 'insert',
      name: 'INSERT',
      description: '插入记录',
      template: 'INSERT INTO ${table} (${columns}) VALUES (${values});',
      category: 'insert',
      variables: ['table', 'columns', 'values']
    },
    {
      id: 'insert-select',
      name: 'INSERT SELECT',
      description: '从查询插入',
      template: 'INSERT INTO ${target_table} SELECT * FROM ${source_table};',
      category: 'insert',
      variables: ['target_table', 'source_table']
    },
    
    // 更新
    {
      id: 'update',
      name: 'UPDATE',
      description: '更新记录',
      template: 'UPDATE ${table} SET ${column} = ${value} WHERE ${condition};',
      category: 'update',
      variables: ['table', 'column', 'value', 'condition']
    },
    {
      id: 'update-multiple',
      name: 'UPDATE 多列',
      description: '更新多列',
      template: 'UPDATE ${table} SET ${column1} = ${value1}, ${column2} = ${value2} WHERE ${condition};',
      category: 'update',
      variables: ['table', 'column1', 'value1', 'column2', 'value2', 'condition']
    },
    
    // 删除
    {
      id: 'delete',
      name: 'DELETE',
      description: '删除记录',
      template: 'DELETE FROM ${table} WHERE ${condition};',
      category: 'delete',
      variables: ['table', 'condition']
    },
    {
      id: 'truncate',
      name: 'TRUNCATE',
      description: '清空表',
      template: 'TRUNCATE TABLE ${table};',
      category: 'delete',
      variables: ['table']
    },
    
    // DDL
    {
      id: 'create-table',
      name: 'CREATE TABLE',
      description: '创建表',
      template: `CREATE TABLE \${table} (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,
      category: 'ddl',
      variables: ['table']
    },
    {
      id: 'alter-add-column',
      name: 'ALTER ADD COLUMN',
      description: '添加列',
      template: 'ALTER TABLE ${table} ADD COLUMN ${column} ${type};',
      category: 'ddl',
      variables: ['table', 'column', 'type']
    },
    {
      id: 'create-index',
      name: 'CREATE INDEX',
      description: '创建索引',
      template: 'CREATE INDEX idx_${table}_${column} ON ${table} (${column});',
      category: 'ddl',
      variables: ['table', 'column']
    },
    {
      id: 'drop-table',
      name: 'DROP TABLE',
      description: '删除表',
      template: 'DROP TABLE ${table};',
      category: 'ddl',
      variables: ['table']
    },
    
    // 其他
    {
      id: 'explain',
      name: 'EXPLAIN',
      description: '查询执行计划',
      template: 'EXPLAIN ${query};',
      category: 'common',
      variables: ['query']
    },
    {
      id: 'transaction',
      name: 'TRANSACTION',
      description: '事务块',
      template: `BEGIN;
-- SQL statements
COMMIT;`,
      category: 'common',
      variables: []
    },
    {
      id: 'show-tables',
      name: 'SHOW TABLES',
      description: '显示所有表',
      template: 'SHOW TABLES;',
      category: 'common',
      variables: []
    },
    {
      id: 'describe-table',
      name: 'DESCRIBE',
      description: '查看表结构',
      template: 'DESCRIBE ${table};',
      category: 'common',
      variables: ['table']
    }
  ];

  private customSnippets: SqlSnippet[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.loadCustomSnippets();
  }

  /**
   * 加载自定义片段
   */
  private loadCustomSnippets(): void {
    const stored = this.context.globalState.get<SqlSnippet[]>('customSqlSnippets', []);
    this.customSnippets = stored;
  }

  /**
   * 保存自定义片段
   */
  private saveCustomSnippets(): void {
    this.context.globalState.update('customSqlSnippets', this.customSnippets);
  }

  /**
   * 获取所有片段
   */
  getAllSnippets(): SqlSnippet[] {
    return [...SqlSnippetService.DEFAULT_SNIPPETS, ...this.customSnippets];
  }

  /**
   * 按分类获取片段
   */
  getByCategory(category: SqlSnippet['category']): SqlSnippet[] {
    return this.getAllSnippets().filter(s => s.category === category);
  }

  /**
   * 搜索片段
   */
  search(query: string): SqlSnippet[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllSnippets().filter(
      s => s.name.toLowerCase().includes(lowerQuery) || 
           s.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 获取片段内容
   */
  getSnippet(id: string): SqlSnippet | undefined {
    return this.getAllSnippets().find(s => s.id === id);
  }

  /**
   * 添加自定义片段
   */
  addCustomSnippet(snippet: Omit<SqlSnippet, 'id'>): SqlSnippet {
    const newSnippet: SqlSnippet = {
      ...snippet,
      id: `custom-${Date.now()}`
    };
    this.customSnippets.push(newSnippet);
    this.saveCustomSnippets();
    return newSnippet;
  }

  /**
   * 删除自定义片段
   */
  deleteCustomSnippet(id: string): boolean {
    const index = this.customSnippets.findIndex(s => s.id === id);
    if (index === -1) return false;
    
    this.customSnippets.splice(index, 1);
    this.saveCustomSnippets();
    return true;
  }

  /**
   * 插入片段到编辑器
   */
  async insertSnippet(snippet: SqlSnippet): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('请先打开 SQL 文件');
      return;
    }

    let template = snippet.template;
    
    // 替换变量为占位符
    if (snippet.variables && snippet.variables.length > 0) {
      const placeholders: vscode.SnippetString[] = [];
      snippet.variables.forEach((v, i) => {
        template = template.replace(new RegExp(`\\$\\{${v}\\}`, 'g'), `\${${i + 1}:${v}}`);
      });
      
      const snippetString = new vscode.SnippetString(template);
      await editor.insertSnippet(snippetString);
    } else {
      await editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, template);
      });
    }
  }

  /**
   * 显示片段选择器
   */
  async showSnippetPicker(): Promise<void> {
    const snippets = this.getAllSnippets();
    
    const items = snippets.map(s => ({
      label: s.name,
      description: s.description,
      detail: `分类：${s.category}`,
      snippet: s
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '选择 SQL 片段',
      matchOnDescription: true
    });

    if (selected) {
      await this.insertSnippet(selected.snippet);
    }
  }

  dispose(): void {
    // 清理资源
  }
}
