# Berry DB - VSCode 数据库客户端扩展

<div align="center">

**轻量级、功能完整的多数据库客户端**

支持 SQLite · PostgreSQL · MySQL · Redis

</div>

## 📋 功能特性

### 支持的数据库

| 数据库 | 状态 |
|--------|------|
| SQLite | ✅ |
| PostgreSQL | ✅ |
| MySQL / MariaDB | ✅ |
| Redis | ✅ |

### 核心功能

#### 连接管理 🔌
- 多数据库连接配置
- SSH 隧道 / SSL 支持
- 密码加密存储
- 连接测试
- 自动重连

#### 数据库浏览器 📁
- 树形结构展示
- 懒加载优化
- 右键菜单操作
- 图标区分类型

#### 表结构管理 📐
- 查看表数据
- 查看表结构（列、索引、外键）
- 表结构可视化编辑器
- 删除/清空表

#### SQL 查询 📝
- 语法高亮编辑器
- 多语句执行
- 结果网格展示（分页）
- 导出（CSV/JSON/SQL）

#### 查询历史 📚
- 自动记录所有查询
- 重新执行历史查询
- 清空历史
- 按连接筛选

#### 收藏查询 ⭐
- 保存常用查询
- 分类管理
- 快速访问

#### Redis 专用 🔴
- Key 浏览与管理
- 数据类型支持（String/Hash/List/Set/ZSet）
- Key 详情查看
- **Redis CLI 终端**

#### ER 图可视化 🗺️
- 自动生成表关系图
- 可拖拽调整布局
- 显示主键/外键关系
- 缩放功能

#### 数据导入/导出 📤
- CSV/JSON/SQL 导入
- 表数据导出
- 数据库备份

---

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 调试运行
```bash
npm run watch
```
按 **F5** 启动扩展开发主机。

### 打包扩展
```bash
npm run package
```

---

## 📖 使用指南

### 创建第一个连接

1. 点击左侧活动栏的数据库图标 🗄️
2. 点击连接面板右上角的 **+** 按钮
3. 选择数据库类型
4. 填写连接信息
5. 点击 **测试连接** 验证
6. 点击 **保存**

### 执行查询

1. 右键点击数据库 → **Open Query Editor**
2. 输入 SQL 语句
3. 点击运行按钮执行

### 查看表结构

1. 在连接树中展开表节点
2. 右键点击表 → **View Structure**
3. 或点击 **Edit Structure** 打开可视化编辑器

### 使用 Redis CLI

1. 连接 Redis 数据库
2. 点击工具栏 **Redis CLI** 按钮
3. 输入命令如 `GET key`、`HGETALL hash`
4. 按 Enter 执行

### 查看 ER 图

1. 点击连接面板工具栏 **Show ER Diagram**
2. 查看表关系图
3. 可拖拽调整表位置
4. 支持缩放和导出

---

## ⌨️ 命令列表

| 命令 | 描述 |
|------|------|
| `berry-db.addConnection` | 添加新连接 |
| `berry-db.editConnection` | 编辑连接 |
| `berry-db.deleteConnection` | 删除连接 |
| `berry-db.connect` | 连接数据库 |
| `berry-db.disconnect` | 断开连接 |
| `berry-db.openQueryEditor` | 打开查询编辑器 |
| `berry-db.rerunQuery` | 重新执行历史查询 |
| `berry-db.clearQueryHistory` | 清空查询历史 |
| `berry-db.saveQuery` | 保存查询到收藏 |
| `berry-db.showSavedQueries` | 显示收藏查询 |
| `berry-db.viewTableData` | 查看表数据 |
| `berry-db.viewTableStructure` | 查看表结构 |
| `berry-db.editTableStructure` | 编辑表结构 |
| `berry-db.dropTable` | 删除表 |
| `berry-db.viewRedisKey` | 查看 Redis Key |
| `berry-db.deleteRedisKey` | 删除 Redis Key |
| `berry-db.openRedisCLI` | 打开 Redis CLI |
| `berry-db.showERDiagram` | 显示 ER 图 |

---

## ⚙️ 配置项

| 配置项 | 描述 | 默认值 |
|--------|------|--------|
| `berry-db.queryTimeout` | 查询超时（毫秒） | 30000 |
| `berry-db.maxResults` | 最大结果行数 | 1000 |
| `berry-db.autoRefresh` | 自动刷新结构 | false |
| `berry-db.readOnlyMode` | 默认只读模式 | true |

---

## 🏗️ 项目结构

```
berry-db/
├── src/
│   ├── extension.ts                    # 入口
│   ├── types/index.ts                  # 类型定义
│   ├── services/
│   │   ├── ConnectionManager.ts        # 连接管理
│   │   ├── QueryHistoryService.ts      # 查询历史
│   │   ├── SavedQueryService.ts        # 收藏查询
│   │   └── database/
│   │       ├── DatabaseService.ts      # 抽象基类
│   │       ├── SqliteService.ts
│   │       ├── PostgresService.ts
│   │       ├── MySqlService.ts
│   │       └── RedisService.ts
│   ├── providers/
│   │   ├── ConnectionProvider.ts       # 连接树
│   │   ├── QueryHistoryProvider.ts     # 历史树
│   │   └── QueryResultProvider.ts      # 结果展示
│   ├── commands/
│   │   └── CommandHandler.ts           # 命令处理
│   └── webviews/
│       ├── ConnectionForm.ts           # 连接表单
│       ├── TableEditor.ts              # 表编辑器
│       ├── QueryResult.ts              # 查询结果
│       ├── RedisCli.ts                 # Redis CLI
│       └── ErDiagram.ts                # ER 图
├── resources/icons/                    # 图标
├── syntaxes/                           # SQL 语法
├── package.json
└── tsconfig.json
```

---

## 🛠️ 技术栈

- **TypeScript** - 主要语言
- **VSCode Extension API** - 扩展框架
- **sql.js** - SQLite (WASM)
- **pg** - PostgreSQL
- **mysql2** - MySQL
- **ioredis** - Redis

---

## 📝 开发规范

### 代码风格
- TypeScript 严格模式
- ESLint 规范
- JSDoc 注释

### 提交规范
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/配置
```

---

## 🔒 安全注意

1. 密码使用 `SecretStorage` 加密存储
2. 危险操作（DROP/TRUNCATE）需二次确认
3. 支持 SSH 隧道安全连接
4. 查询超时限制防止长时间占用

---

## 📄 许可证

MIT License

---

<div align="center">

**Made with ❤️ for developers**

</div>
