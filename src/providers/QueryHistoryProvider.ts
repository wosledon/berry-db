/**
 * 查询历史树形视图提供者
 */

import * as vscode from 'vscode';
import { QueryHistoryService } from '../services/QueryHistoryService';
import type { QueryHistoryItem } from '../types';

export class QueryHistoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly item: QueryHistoryItem,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(item.query.substring(0, 50) + (item.query.length > 50 ? '...' : ''), collapsibleState);

    this.tooltip = this.createTooltip();
    this.description = new Date(item.timestamp).toLocaleString();
    this.contextValue = 'queryHistory';
    this.iconPath = item.success 
      ? new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green')) 
      : new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
    
    this.command = {
      command: 'berry-db.rerunQuery',
      title: '重新执行',
      arguments: [item]
    };
  }

  private createTooltip(): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.appendCodeblock(this.item.query, 'sql');
    tooltip.appendMarkdown(`\n\n---\n`);
    tooltip.appendMarkdown(`**时间**: ${new Date(this.item.timestamp).toLocaleString()}\n`);
    tooltip.appendMarkdown(`**状态**: ${this.item.success ? '✅ 成功' : '❌ 失败'}\n`);
    tooltip.appendMarkdown(`**耗时**: ${this.item.duration}ms\n`);
    if (this.item.databaseName) {
      tooltip.appendMarkdown(`**数据库**: ${this.item.databaseName}\n`);
    }
    if (this.item.error) {
      tooltip.appendMarkdown(`\n**错误**: ${this.item.error}\n`);
    }
    return tooltip;
  }
}

export class QueryHistoryProvider implements vscode.TreeDataProvider<QueryHistoryTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<QueryHistoryTreeItem | undefined | null | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<QueryHistoryTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private historyService: QueryHistoryService) {
    this.historyService.onDidChangeHistory(() => {
      this.refresh();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: QueryHistoryTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: QueryHistoryTreeItem): Promise<QueryHistoryTreeItem[]> {
    if (element) {
      return [];
    }

    const history = this.historyService.getAllHistory();
    
    if (history.length === 0) {
      return [new vscode.TreeItem('暂无查询历史') as unknown as QueryHistoryTreeItem];
    }

    return history.map(item => new QueryHistoryTreeItem(item));
  }
}
