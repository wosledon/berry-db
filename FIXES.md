# 修复日志 - 2026-02-25

## 问题 1: 连接不存在错误
**原因**: 传入的参数是对象而不是字符串
**修复**: 
- 确保 `arguments: [conn.id]` 传递字符串
- 修复 ConnectionProvider 中的 contextValue 设置

## 问题 2: 右键菜单不显示
**原因**: package.json 中的 when 条件使用正则表达式，VSCode 可能不支持
**修复**:
- 改用精确匹配: `viewItem == connectionConnected || viewItem == connectionDisconnected`
- 确保 ConnectionTreeItem 的 contextValue 正确设置

## 问题 3: 删除连接没有作用
**原因**: 
1. 右键菜单不显示导致无法触发命令
2. package.json 格式错误（重复的菜单项）
**修复**:
- 修复 package.json 格式
- 简化 when 条件
- 确保 deleteConnection 方法正确触发事件

## 问题 4: 查询不能执行
**原因**: executeQuery 方法未实现
**修复**:
- 实现完整的 executeQuery 方法
- 支持选择执行或全文执行
- 支持多连接选择
- 结果显示在右侧面板

## 问题 5: workbench.actions.view.refresh 命令不存在
**原因**: 使用了不存在的 VSCode 命令
**修复**:
- 改用 `connectionManager.onDidChangeConnectionsEmitter.fire(undefined)` 触发事件
- 将 EventEmitter 设为 public

## 问题 6: document is not defined
**原因**: 在 Node.js 环境中使用了 DOM API
**修复**:
- 重写 escapeHtml 函数，使用纯字符串替换
```typescript
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

## 问题 7: 左侧面板显示不完整
**原因**: 表节点的子项没有正确设置 contextValue
**修复**:
- 确保所有 ConnectionTreeItem 都正确设置 contextValue
- 添加详细的表结构信息（字段/索引/外键）

## 新增功能

### 1. 查询结果面板
- DataGrip 风格的数据网格
- 显示在右侧面板（ViewColumn.Two）
- 支持工具栏、查询预览、状态栏
- 支持复制、导出功能

### 2. 调试工具
- 新增 `Berry DB: Debug Connections` 命令
- 显示所有连接的详细信息
- 帮助诊断右键菜单问题

### 3. 新建查询入口
- 左侧工具栏添加 📄 New Query 按钮
- 右键菜单添加 Open Query Editor
- 命令面板添加 New Query

## 文件修改清单

1. `src/providers/ConnectionProvider.ts`
   - 修复 contextValue 设置
   - 优化连接节点的 command 设置

2. `src/commands/CommandHandler.ts`
   - 实现 executeQuery 方法
   - 修复 connect 方法的刷新逻辑
   - 添加 debugConnections 方法

3. `src/services/ConnectionManager.ts`
   - 将 onDidChangeConnectionsEmitter 设为 public

4. `src/providers/QueryResultView.ts`
   - 重写 escapeHtml 函数
   - 完整的 DataGrip 风格界面

5. `package.json`
   - 修复菜单配置格式
   - 简化 when 条件
   - 添加新命令

## 测试建议

1. 重新加载窗口: `Ctrl+Shift+P` → `Developer: Reload Window`
2. 运行调试命令: `Berry DB: Debug Connections`
3. 测试右键菜单功能
4. 测试连接管理功能
5. 测试查询执行功能
