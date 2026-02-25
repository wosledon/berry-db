/**
 * 收藏查询服务
 * 管理和保存常用查询
 */

import * as vscode from 'vscode';
import type { SavedQuery } from '../types';

export class SavedQueryService implements vscode.Disposable {
  private _onDidChangeQueries: vscode.EventEmitter<void> = new vscode.EventEmitter();
  
  public readonly onDidChangeQueries: vscode.Event<void> = this._onDidChangeQueries.event;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * 获取所有收藏查询
   */
  getAllQueries(): SavedQuery[] {
    return this.context.globalState.get<SavedQuery[]>('savedQueries', []);
  }

  /**
   * 按连接筛选收藏查询
   */
  getByConnection(connectionId?: string): SavedQuery[] {
    const all = this.getAllQueries();
    if (!connectionId) {
      return all.filter(q => !q.connectionId);
    }
    return all.filter(q => q.connectionId === connectionId);
  }

  /**
   * 保存查询
   */
  saveQuery(query: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'>): SavedQuery {
    const queries = this.getAllQueries();
    
    const now = Date.now();
    const newQuery: SavedQuery = {
      ...query,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: now,
      updatedAt: now
    };

    queries.push(newQuery);
    this.context.globalState.update('savedQueries', queries);
    this._onDidChangeQueries.fire();
    
    return newQuery;
  }

  /**
   * 更新查询
   */
  updateQuery(id: string, updates: Partial<SavedQuery>): boolean {
    const queries = this.getAllQueries();
    const index = queries.findIndex(q => q.id === id);
    
    if (index === -1) {
      return false;
    }

    queries[index] = {
      ...queries[index],
      ...updates,
      updatedAt: Date.now()
    };

    this.context.globalState.update('savedQueries', queries);
    this._onDidChangeQueries.fire();
    return true;
  }

  /**
   * 删除查询
   */
  deleteQuery(id: string): boolean {
    const queries = this.getAllQueries();
    const filtered = queries.filter(q => q.id !== id);
    
    if (filtered.length === queries.length) {
      return false;
    }

    this.context.globalState.update('savedQueries', filtered);
    this._onDidChangeQueries.fire();
    return true;
  }

  /**
   * 根据 ID 获取查询
   */
  getQuery(id: string): SavedQuery | undefined {
    return this.getAllQueries().find(q => q.id === id);
  }

  /**
   * 清空所有收藏
   */
  clearAll(): void {
    this.context.globalState.update('savedQueries', []);
    this._onDidChangeQueries.fire();
  }

  dispose(): void {
    this._onDidChangeQueries.dispose();
  }
}
