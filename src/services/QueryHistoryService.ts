/**
 * 查询历史服务
 * 记录和管理所有执行的查询
 */

import * as vscode from 'vscode';
import type { QueryHistoryItem } from '../types';

export class QueryHistoryService implements vscode.Disposable {
  private static readonly MAX_HISTORY = 100;
  private history: QueryHistoryItem[] = [];
  private _onDidChangeHistory: vscode.EventEmitter<void> = new vscode.EventEmitter();
  
  public readonly onDidChangeHistory: vscode.Event<void> = this._onDidChangeHistory.event;

  constructor(private context: vscode.ExtensionContext) {
    this.loadHistory();
  }

  /**
   * 加载历史记录
   */
  private loadHistory(): void {
    const stored = this.context.globalState.get<QueryHistoryItem[]>('queryHistory', []);
    this.history = stored;
  }

  /**
   * 保存历史记录
   */
  private saveHistory(): void {
    this.context.globalState.update('queryHistory', this.history);
  }

  /**
   * 添加查询历史
   */
  addHistory(item: Omit<QueryHistoryItem, 'id' | 'timestamp'>): void {
    const historyItem: QueryHistoryItem = {
      ...item,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };

    this.history.unshift(historyItem);
    
    // 限制历史记录数量
    if (this.history.length > QueryHistoryService.MAX_HISTORY) {
      this.history = this.history.slice(0, QueryHistoryService.MAX_HISTORY);
    }

    this.saveHistory();
    this._onDidChangeHistory.fire();
  }

  /**
   * 获取所有历史记录
   */
  getAllHistory(): QueryHistoryItem[] {
    return [...this.history];
  }

  /**
   * 按连接筛选历史记录
   */
  getByConnection(connectionId: string): QueryHistoryItem[] {
    return this.history.filter(item => item.connectionId === connectionId);
  }

  /**
   * 删除历史记录
   */
  deleteHistory(id: string): void {
    this.history = this.history.filter(item => item.id !== id);
    this.saveHistory();
    this._onDidChangeHistory.fire();
  }

  /**
   * 清空历史记录
   */
  clearHistory(): void {
    this.history = [];
    this.saveHistory();
    this._onDidChangeHistory.fire();
  }

  /**
   * 清空指定连接的历史记录
   */
  clearConnectionHistory(connectionId: string): void {
    this.history = this.history.filter(item => item.connectionId !== connectionId);
    this.saveHistory();
    this._onDidChangeHistory.fire();
  }

  /**
   * 重新执行历史查询
   */
  async rerunQuery(item: QueryHistoryItem): Promise<void> {
    // 添加到历史（作为新记录）
    this.addHistory({
      connectionId: item.connectionId,
      databaseName: item.databaseName,
      query: item.query,
      success: false, // 执行结果由调用者更新
      duration: 0
    });

    // 触发执行查询命令
    await vscode.commands.executeCommand('berry-db.executeQueryFromHistory', item);
  }

  dispose(): void {
    this._onDidChangeHistory.dispose();
  }
}
