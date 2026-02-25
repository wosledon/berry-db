# Berry DB 快速参考卡片

## 🚀 快速开始

```
1. 重新加载: Ctrl+Shift+P → Developer: Reload Window
2. 点击: 左侧数据库图标 🗄️
3. 新建: 点击 + 按钮
4. 连接: 点击连接节点
5. 查询: 点击 📄 New Query
```

## 📋 常用命令

| 命令 | 快捷方式 | 说明 |
|------|----------|------|
| New Query | 左侧 📄 按钮 | 新建 SQL 查询 |
| Add Connection | 左侧 + 按钮 | 添加新连接 |
| Debug Connections | Ctrl+Shift+P | 调试连接状态 |
| Run Tests | Ctrl+Shift+P | 运行测试 |

## 🖱️ 右键菜单

### 连接节点
- Edit Connection - 编辑连接
- Delete Connection - 删除连接
- Connect/Disconnect - 连接/断开

### 表节点
- View Data - 查看数据
- View Structure - 查看结构
- Drop Table - 删除表

### 数据库节点
- Open Query Editor - 打开查询编辑器

## 🔧 连接管理

### 新建连接
1. 点击 +
2. 选择类型 (SQLite/PostgreSQL/MySQL/Redis)
3. 填写信息
4. 测试连接
5. 保存

### 连接/断开
- 连接: 点击节点
- 断开: 点击插头图标

### 编辑/删除
- 右键点击节点
- 选择相应选项

## 📝 查询操作

### 新建查询
- 点击 📄 按钮
- 或右键数据库 → Open Query Editor

### 执行查询
- 全文: 不选中，点击运行
- 选中: 选中部分，点击运行

### 查看结果
- 右侧面板自动显示
- 可复制/导出数据

## 🎨 界面布局

```
┌─────────────────────────────────────────┐
│  左侧面板  │       编辑器       │ 右侧面板  │
│  连接树    │      SQL 文件      │ 查询结果  │
│            │                    │          │
└─────────────────────────────────────────┘
```

## 🐛 调试工具

### 查看连接状态
```
Ctrl+Shift+P → Berry DB: Debug Connections
```

### 运行测试
```
Ctrl+Shift+P → Berry DB: Run Tests
```

### 查看日志
```
Ctrl+Shift+U → 选择 Extension Host
```

## 💡 提示

- 密码自动加密存储
- 结果在右侧面板显示
- 支持多连接同时使用
- 右键菜单提供更多功能

## 📚 文档

- `USER_GUIDE.md` - 详细使用指南
- `TESTING.md` - 测试指南
- `README.md` - 项目介绍

## ⚡ 快捷操作

1. **快速连接**: 点击连接节点
2. **快速查询**: 点击 📄 按钮
3. **快速查看数据**: 右键表 → View Data
4. **快速调试**: 运行 Debug Connections

## 🎯 常见问题

**Q: 右键菜单不显示？**
A: 重新加载窗口，运行 Debug Connections

**Q: 连接失败？**
A: 检查数据库服务，查看输出面板错误

**Q: 查询结果不显示？**
A: 检查右侧面板是否打开，重新执行查询

---

**打印此卡片以备参考！📄**
