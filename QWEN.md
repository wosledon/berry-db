# Berry DB - 项目上下文文档

## 项目概述

**Berry DB** 是一个 VSCode 数据库客户端扩展，支持在 IDE 内直接进行数据库连接、浏览、查询和结构维护操作。

### 项目状态
- ✅ **已完成** - 核心功能已实现，编译通过
- 🚀 **可测试** - 可以在 VSCode 扩展开发主机中运行测试

### 支持数据库（MVP）
| 数据库 | 状态 |
|--------|------|
| SQLite | ✅ 完成 |
| PostgreSQL | ✅ 完成 |
| MySQL / MariaDB | ✅ 完成 |
| Redis | ✅ 完成 |

---

## 技术栈

### 核心语言
- **TypeScript** - 主要开发语言
- **JavaScript/HTML/CSS** - WebViews 界面

### 目标平台
- **VSCode Extension** - 使用 Extension API

### 依赖库
```
sql.js            → SQLite 驱动 (WASM)
pg                → PostgreSQL 驱动
mysql2            → MySQL 驱动
ioredis           → Redis 客户端
ssh2              → SSH 隧道支持
sql-formatter     → SQL 格式化
```

---

## 项目结构

```
berry-db/
├── src/
│   ├── extension.ts                    # 扩展入口
│   ├── types/
│   │   └── index.ts                    # TypeScript 类型定义
│   ├── services/
│   │   ├── ConnectionManager.ts        # 连接管理器
│   │   ├── QueryHistoryService.ts      # 查询历史服务
│   │   └── database/
│   │       ├── DatabaseService.ts      # 数据库服务抽象基类
│   │       ├── SqliteService.ts        # SQLite 实现
│   │       ├── PostgresService.ts      # PostgreSQL 实现
│   │       ├── MySqlService.ts         # MySQL 实现
│   │       └── RedisService.ts         # Redis 实现
│   ├── providers/
│   │   ├── ConnectionProvider.ts       # 连接树提供者
│   │   ├── QueryHistoryProvider.ts     # 查询历史提供者
│   │   └── QueryResultProvider.ts      # 查询结果提供者
│   ├── commands/
│   │   └── CommandHandler.ts           # 命令处理
│   └── webviews/
│       ├── ConnectionForm.ts           # 连接配置表单
│       └── TableEditor.ts              # 表结构编辑器
├── resources/
│   └── icons/                          # 图标资源
├── syntaxes/                           # SQL 语法高亮
├── package.json                        # 扩展配置
├── tsconfig.json                       # TypeScript 配置
└── README.md                           # 项目文档
```

---

## 核心功能模块

### 1. 连接管理 ✅
- 多数据库连接配置（SQLite/PostgreSQL/MySQL/Redis）
- SSH 隧道 / SSL 支持
- 密码加密存储（SecretStorage）
- 连接测试

### 2. 数据库浏览器 ✅
- 树形结构展示
- 懒加载优化
- 搜索与过滤
- 右键菜单操作

### 3. 表结构管理 ✅
- 查看表结构（列、索引、外键）
- 创建/删除表
- 表结构可视化展示
- SQL 预览

### 4. SQL 查询编辑器 ✅
- 语法高亮与智能提示
- **智能代码补全**（关键字/函数/表名/列名）
- **悬停提示**（表结构/列信息）
- **函数签名帮助**
- 多语句执行
- 结果网格展示（分页、排序）
- 导出（CSV/JSON/SQL）

### 5. 查询历史 ✅
- 自动记录所有执行的查询
- 按时间排序
- 重新执行历史查询
- 清空历史

### 6. Redis 专用功能 ✅
- Key 浏览与管理
- 数据类型操作（String/Hash/List/Set/ZSet）
- Key 详情查看（类型、TTL、值）

### 7. 数据导入/导出 ✅
- 文件导入（CSV/JSON/SQL）
- 表结构与数据导出
- 数据库备份

### 8. SQL 智能提示 ✅ (新增)
- **SQL 关键字补全** - SELECT, FROM, WHERE 等
- **SQL 函数补全** - COUNT(), SUM(), AVG() 等
- **数据库对象补全** - 数据库名、表名、列名
- **悬停提示** - 鼠标悬停显示表结构/列信息
- **签名帮助** - 函数参数提示
- **对象缓存** - 自动缓存数据库元数据，5 分钟刷新

---

## 开发约定

### 代码风格
- 使用 **TypeScript** 
- 遵循 **ESLint** 规范
- 函数/类使用 **JSDoc** 注释

### 文件命名
- 源文件：`camelCase.ts`
- 组件文件：`PascalCase.ts`
- 测试文件：`*.test.ts`

### 提交规范
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试相关
chore: 构建/配置
```

---

## 构建与运行

### 安装依赖
```bash
npm install
```

### 调试运行（VSCode 扩展主机）
```bash
npm run watch
```
然后按 F5 启动扩展开发主机。

### 打包扩展
```bash
npm run package
```

### 运行测试
```bash
npm test
```

---

## VSCode 贡献点

### 视图容器
- Activity Bar 图标：`resources/icons/database.svg`
- 连接视图：`connections`
- 查询历史视图：`queryHistory`

### 主要命令
| 命令 ID | 描述 |
|---------|------|
| `berry-db.addConnection` | 添加新连接 |
| `berry-db.editConnection` | 编辑连接 |
| `berry-db.deleteConnection` | 删除连接 |
| `berry-db.connect` | 连接数据库 |
| `berry-db.disconnect` | 断开连接 |
| `berry-db.executeQuery` | 执行 SQL 查询 |
| `berry-db.openQueryEditor` | 打开查询编辑器 |
| `berry-db.rerunQuery` | 重新执行历史查询 |
| `berry-db.clearQueryHistory` | 清空查询历史 |
| `berry-db.createTable` | 创建表 |
| `berry-db.viewTableData` | 查看表数据 |
| `berry-db.viewTableStructure` | 查看表结构 |
| `berry-db.editTableStructure` | 编辑表结构 |
| `berry-db.dropTable` | 删除表 |
| `berry-db.truncateTable` | 清空表 |
| `berry-db.exportData` | 导出数据 |
| `berry-db.importData` | 导入数据 |
| `berry-db.viewRedisKey` | 查看 Redis Key |
| `berry-db.deleteRedisKey` | 删除 Redis Key |

---

## 安全注意事项

1. **凭证存储**：必须使用 `SecretStorage` API 加密
2. **危险操作**：DROP/TRUNCATE 需二次确认
3. **查询限制**：默认只读模式，超时限制
4. **SSH 隧道**：支持远程安全连接

---

## 配置项

| 配置项 | 描述 | 默认值 |
|--------|------|--------|
| `berry-db.queryTimeout` | 查询超时时间（毫秒） | 30000 |
| `berry-db.maxResults` | 查询结果最大行数 | 1000 |
| `berry-db.autoRefresh` | 自动刷新数据库结构 | false |
| `berry-db.readOnlyMode` | 默认只读模式 | true |
| `berry-db.autoConnect` | 启动时自动连接 | false |

---

## 后续开发计划

### 待实现功能
- [ ] 完整的数据内联编辑
- [ ] Redis CLI 终端
- [ ] ER 图可视化
- [ ] 查询收藏夹
- [ ] 批量导入/导出
- [ ] 查询性能分析
- [ ] 数据库文档生成
- [ ] 连接池优化

### 优化项
- [ ] 查询结果虚拟滚动
- [ ] 智能查询建议
- [ ] 主题自定义
- [ ] 多语言支持

---

## 相关文件

| 文件 | 描述 |
|------|------|
| `DESIGN.md` | 完整详细设计文档 |
| `QWEN.md` | 本上下文文件 |
| `README.md` | 项目说明文档 |
| `package.json` | 扩展配置 |

---

## 参考资料

- [VSCode Extension API](https://code.visualstudio.com/api)
- [DESIGN.md](./DESIGN.md) - 完整设计文档

---

## 快速启动

1. 打开项目文件夹
2. 运行 `npm install`（已完成）
3. 运行 `npm run watch`
4. 按 F5 启动扩展开发主机
5. 在新窗口中测试 Berry DB 功能

### 测试步骤
1. 点击左侧数据库图标
2. 点击 + 添加新连接
3. 选择数据库类型（推荐 SQLite 测试）
4. 配置连接信息
5. 连接后即可浏览和管理数据
6. 在查询历史中查看执行的查询
