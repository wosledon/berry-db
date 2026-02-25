/**
 * 状态栏管理器
 * 显示数据库连接状态和快捷操作
 */

import * as vscode from 'vscode';
import { ConnectionManager } from './ConnectionManager';
import type { DatabaseConnection } from '../types';

export class StatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private activeConnectionId?: string;

  constructor(private connectionManager: ConnectionManager) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'berry-db.statusBarClick';
    this.updateStatusBar();
    this.statusBarItem.show();
  }

  /**
   * 更新状态栏
   */
  updateStatusBar(): void {
    const connections = this.connectionManager.getAllConnections();
    
    if (connections.length === 0) {
      this.statusBarItem.text = '$(database) Berry DB: 无连接';
      this.statusBarItem.tooltip = '点击添加数据库连接';
      this.statusBarItem.color = undefined;
      return;
    }

    const activeConnections = connections.filter(conn => 
      this.connectionManager.isConnected(conn.id)
    );

    if (activeConnections.length === 0) {
      this.statusBarItem.text = '$(database) Berry DB: 未连接';
      this.statusBarItem.tooltip = '点击连接数据库';
      this.statusBarItem.color = '#888';
    } else if (activeConnections.length === 1) {
      const conn = activeConnections[0];
      this.statusBarItem.text = `$(plug) ${conn.name}`;
      this.statusBarItem.tooltip = `${conn.type.toUpperCase()} - ${conn.name}\n点击查看详情`;
      this.statusBarItem.color = '#4caf50';
      this.activeConnectionId = conn.id;
    } else {
      this.statusBarItem.text = `$(database) ${activeConnections.length} 个连接`;
      this.statusBarItem.tooltip = `已连接 ${activeConnections.length} 个数据库\n点击查看详情`;
      this.statusBarItem.color = '#2196f3';
    }
  }

  /**
   * 显示连接详情
   */
  async showConnectionDetails(): Promise<void> {
    const connections = this.connectionManager.getAllConnections();
    
    if (connections.length === 0) {
      const action = await vscode.window.showInformationMessage(
        '暂无数据库连接',
        '添加连接'
      );
      
      if (action === '添加连接') {
        await vscode.commands.executeCommand('berry-db.addConnection');
      }
      return;
    }

    const items = connections.map(conn => {
      const isConnected = this.connectionManager.isConnected(conn.id);
      return {
        label: `${isConnected ? '$(plug)' : '$(circle-slash)'} ${conn.name}`,
        description: `${conn.type.toUpperCase()} - ${isConnected ? '已连接' : '未连接'}`,
        connection: conn
      };
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '选择数据库连接'
    });

    if (selected) {
      const conn = selected.connection;
      const isConnected = this.connectionManager.isConnected(conn.id);
      
      const actions: string[] = [];
      if (isConnected) {
        actions.push('断开连接', '查看表', '打开查询编辑器', '新建查询');
      } else {
        actions.push('连接', '编辑连接', '删除连接');
      }
      actions.push('取消');

      const action = await vscode.window.showQuickPick(actions, {
        placeHolder: `操作：${conn.name}`
      });

      switch (action) {
        case '连接':
          await vscode.commands.executeCommand('berry-db.connect', conn.id);
          break;
        case '断开连接':
          await vscode.commands.executeCommand('berry-db.disconnect', conn.id);
          break;
        case '编辑连接':
          await vscode.commands.executeCommand('berry-db.editConnection', conn.id);
          break;
        case '删除连接':
          await vscode.commands.executeCommand('berry-db.deleteConnection', conn.id);
          break;
        case '查看表':
          // 打开连接树
          await vscode.commands.executeCommand('berry-db.refreshConnection');
          break;
        case '打开查询编辑器':
          await vscode.commands.executeCommand('berry-db.openQueryEditor');
          break;
        case '新建查询':
          await vscode.commands.executeCommand('berry-db.openQueryEditor');
          break;
      }

      this.updateStatusBar();
    }
  }

  /**
   * 显示通知
   */
  showNotification(message: string, type: 'info' | 'error' | 'warning' = 'info'): void {
    vscode.window.showInformationMessage(`Berry DB: ${message}`);
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
