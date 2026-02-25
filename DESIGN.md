# Berry DB - VSCode 数据库客户端插件设计文档

## 概述 📋

Berry DB 是一个轻量级、多数据库支持的 VSCode 扩展，允许开发者在 IDE 内直接进行数据库连接、浏览、查询和结构维护操作。

**目标用户**：全栈开发者、后端工程师、DBA、数据分析师

---

## 支持的数据库 🗄️

### 初期支持（MVP）
| 数据库 | 类型 | 优先级 |
|--------|------|--------|
| SQLite | 关系型 | P0 |
| PostgreSQL | 关系型 | P0 |
| MySQL / MariaDB | 关系型 | P0 |
| Redis | 键值存储 | P0 |

### 未来扩展
- MongoDB（文档型）
- SQL Server（关系型）
- Oracle（关系型）
- ClickHouse（分析型）

---

## 核心功能 🎯

### 1. 连接管理 🔌

#### 功能列表
- **新建连接**：支持手动配置或从连接字符串导入
- **连接模板**：预置常见数据库的默认配置
- **连接测试**：一键测试连接可用性
- **连接分组**：按项目/环境（开发/测试/生产）组织连接
- **安全存储**：使用 VSCode SecretStorage API 加密存储密码
- **SSH 隧道**：支持通过 SSH 隧道连接远程数据库
- **SSL/TLS**：支持加密连接配置

#### 连接配置项
```typescript
interface DatabaseConnection {
  id: string;
  name: string;
  type: 'sqlite' | 'postgresql' | 'mysql' | 'redis';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string; // 加密存储
  // SQLite 特有
  filePath?: string;
  // 高级选项
  ssl?: boolean;
  sshTunnel?: SSHTunnelConfig;
  connectionTimeout?: number;
  queryTimeout?: number;
}
```

---

### 2. 数据库浏览器 📁

#### 树形视图结构
```
📦 连接名称
├── 📊 数据库 (PostgreSQL/MySQL)
│   ├── 📋 表
│   │   ├── 表名
│   │   │   ├── 列
│   │   │   ├── 索引
│   │   │   ├── 外键
│   │   │   └── 触发器
│   │   └── ...
│   ├── 🔗 视图
│   ├── ⚡ 存储过程/函数
│   └── 📜 序列
├── 🔑 Redis
│   ├── Keys (支持模式匹配)
│   ├── String
│   ├── Hash
│   ├── List
│   ├── Set
│   └── ZSet
└── ⏱️ 查询历史
```

#### 功能
- **刷新**：手动/自动刷新数据库结构
- **搜索过滤**：快速定位表/视图
- **右键菜单**：提供常用操作入口
- **图标区分**：不同对象类型使用不同图标
- **懒加载**：按需加载子节点，提升性能

---

### 3. 表结构管理 📐

#### 表操作
| 操作 | 描述 |
|------|------|
| 创建表 | 可视化表单或 SQL 生成 |
| 修改表结构 | 添加/删除/修改列 |
| 删除表 | 支持级联删除确认 |
| 复制表 | 复制表结构或结构 + 数据 |
| 截断表 | 清空数据 |
| 重命名表 | 修改表名 |

#### 列管理
- 添加/删除列
- 修改列名、数据类型、长度
- 设置默认值
- 设置 NOT NULL 约束
- 设置自增（AUTO_INCREMENT / SERIAL）
- 添加/修改列注释

#### 约束管理
- **主键**：单列/复合主键
- **外键**：引用约束、级联操作（CASCADE/SET NULL/RESTRICT）
- **唯一约束**：单列/复合唯一
- **检查约束**：条件检查（CHECK）

#### 索引管理
- 创建/删除索引
- 索引类型：普通索引、唯一索引、全文索引、组合索引
- 查看索引使用情况
- 索引分析与优化建议

---

### 4. 数据查询与编辑 📝

#### SQL 查询编辑器
- **语法高亮**：SQL 关键字、函数、表名高亮
- **智能提示**：表名、列名、关键字自动补全
- **代码格式化**：一键格式化 SQL
- **多语句执行**：支持批量执行多个 SQL
- **执行计划**：EXPLAIN 可视化展示
- **查询参数化**：防止 SQL 注入

#### 查询结果展示
- **表格视图**：分页显示、列宽调整、冻结列
- **排序**：点击列头排序
- **过滤**：列级别过滤条件
- **导出**：CSV、JSON、Excel、SQL INSERT 语句
- **复制**：复制选中行/单元格
- **统计信息**：总行数、执行时间

#### 数据编辑
- **内联编辑**：直接在结果网格中编辑数据
- **批量编辑**：多行修改
- **数据类型验证**：根据列类型进行输入验证
- **NULL 处理**：快捷设置 NULL 值
- **撤销/重做**：提交前的修改可撤销
- **事务管理**：手动提交/回滚

---

### 5. Redis 专用功能 🔴

#### Key 管理
- **浏览 Keys**：支持 glob 模式匹配（`user:*`）
- **Key 详情**：查看类型、TTL、值
- **Key 操作**：新增、修改、删除、刷新 TTL
- **批量删除**：按模式批量删除 Keys
- **Key 分析**：内存占用分析

#### 数据类型支持
| 类型 | 操作 |
|------|------|
| String | 查看/设置值、原子增减 |
| Hash | 字段增删改查、批量操作 |
| List | 推入/弹出、范围查询、修剪 |
| Set | 成员管理、集合运算 |
| ZSet | 带分数成员管理、范围查询 |

#### 命令行终端
- 内嵌 Redis CLI
- 命令历史与自动补全
- 命令文档提示

---

### 6. 数据导入/导出 📤

#### 导入
- 从 CSV/JSON 文件导入数据
- 从 SQL 文件执行脚本
- 数据映射配置
- 导入预览与错误处理

#### 导出
- 导出表结构（DDL）
- 导出表数据（CSV/JSON/SQL/Excel）
- 导出查询结果
- 导出整个数据库（备份）
- 定时导出任务（未来）

---

### 7. 查询历史与收藏 📚

#### 查询历史
- 自动记录所有执行的查询
- 按时间/数据库筛选
- 搜索历史查询
- 重新执行历史查询
- 清理历史记录

#### 收藏查询
- 保存常用查询
- 分组管理收藏
- 参数化收藏查询
- 分享收藏（团队功能 - 未来）

---

### 8. ER 图可视化 🗺️

#### 功能
- 自动生成表关系图
- 显示主键、外键关系
- 拖拽调整布局
- 导出为 PNG/SVG
- 反向工程：从 ER 图生成 DDL（未来）

---

## 技术架构 🏗️

### 项目结构
```
berry-db/
├── src/
│   ├── extension.ts              # 扩展入口
│   ├── providers/
│   │   ├── connectionProvider.ts # 连接树提供者
│   │   ├── resultProvider.ts     # 结果视图提供者
│   │   └── ...
│   ├── services/
│   │   ├── database/
│   │   │   ├── DatabaseService.ts    # 数据库服务抽象
│   │   │   ├── SqliteService.ts      # SQLite 实现
│   │   │   ├── PostgresService.ts    # PostgreSQL 实现
│   │   │   ├── MySqlService.ts       # MySQL 实现
│   │   │   └── RedisService.ts       # Redis 实现
│   │   ├── connectionManager.ts    # 连接池管理
│   │   └── queryExecutor.ts        # 查询执行器
│   ├── commands/
│   │   ├── connectionCommands.ts   # 连接相关命令
│   │   ├── queryCommands.ts        # 查询相关命令
│   │   └── tableCommands.ts        # 表管理命令
│   ├── webviews/
│   │   ├── queryEditor/          # SQL 编辑器
│   │   ├── tableEditor/          # 表结构编辑器
│   │   ├── connectionForm/       # 连接配置表单
│   │   └── erDiagram/            # ER 图视图
│   ├── utils/
│   │   ├── sqlFormatter.ts       # SQL 格式化
│   │   ├── validators.ts         # 数据验证
│   │   └── logger.ts             # 日志工具
│   └── types/
│       └── index.ts              # 类型定义
├── resources/
│   ├── icons/                    # 图标资源
│   └── themes/                   # 主题配置
├── package.json                  # 扩展配置
└── tsconfig.json
```

### 依赖库选型
```json
{
  "dependencies": {
    "better-sqlite3": "^9.0.0",      // SQLite
    "pg": "^8.11.0",                  // PostgreSQL
    "mysql2": "^3.6.0",               // MySQL
    "ioredis": "^5.3.0",              // Redis
    "ssh2": "^1.14.0",                // SSH 隧道
    "sql-formatter": "^13.0.0",       // SQL 格式化
    "vscode-languageclient": "^8.0.0" // 语言服务
  }
}
```

### 架构图
```
┌─────────────────────────────────────────────────────────────┐
│                        VSCode Extension                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Side Bar   │  │   Editor    │  │     WebViews        │  │
│  │  Tree View  │  │  (SQL/Tab)  │  │  (React/Vue)        │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         └────────────────┼─────────────────────┘             │
│                          │                                    │
│                  ┌───────▼────────┐                          │
│                  │  Command API   │                          │
│                  └───────┬────────┘                          │
│                          │                                    │
│         ┌────────────────┼─────────────────┐                 │
│         │                │                 │                 │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐          │
│  │  Connection │  │   Query     │  │   Table     │          │
│  │  Manager    │  │  Executor   │  │  Manager    │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                 │                 │
│         └────────────────┼─────────────────┘                 │
│                          │                                    │
│              ┌───────────▼────────────┐                      │
│              │   Database Services    │                      │
│              │  ┌────┬────┬────┬────┐ │                      │
│              │  │SQLite│ PG │MySQL│Redis│ │                  │
│              │  └────┴────┴────┴────┘ │                      │
│              └───────────┬────────────┘                      │
└──────────────────────────┼───────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Database   │
                    │  Server     │
                    └─────────────┘
```

---

## VSCode 集成点 🔗

### 贡献点（Contribution Points）

#### 1. 视图容器（View Containers）
```json
"viewsContainers": {
  "activitybar": [{
    "id": "berry-db",
    "title": "Berry DB",
    "icon": "resources/icons/database.svg"
  }]
}
```

#### 2. 视图（Views）
```json
"views": {
  "berry-db": [{
    "id": "connections",
    "name": "Connections",
    "icon": "resources/icons/connection.svg"
  }]
}
```

#### 3. 命令（Commands）
```json
"commands": [
  {"command": "berry-db.addConnection", "title": "Add Connection"},
  {"command": "berry-db.executeQuery", "title": "Execute Query"},
  {"command": "berry-db.refreshConnection", "title": "Refresh"},
  {"command": "berry-db.createTable", "title": "Create Table"},
  {"command": "berry-db.exportData", "title": "Export Data"},
  {"command": "berry-db.openQueryEditor", "title": "Open Query Editor"}
]
```

#### 4. 菜单（Menus）
```json
"menus": {
  "view/item/context": [
    {
      "command": "berry-db.executeQuery",
      "when": "view == connections && viewItem == database",
      "group": "navigation"
    }
  ]
}
```

#### 5. 语言支持（Language Support）
```json
"languages": [{
  "id": "sql",
  "extensions": [".sql"],
  "configuration": "./language-configuration.json"
}]
```

---

## 安全考虑 🔐

### 凭证安全
- 使用 VSCode `SecretStorage` API 加密存储密码
- 支持从系统密钥链读取凭证
- 连接字符串中的密码可选存储

### 连接安全
- 支持 SSL/TLS 加密连接
- 支持 SSH 隧道
- 生产环境连接需要二次确认

### 查询安全
- 默认只读模式
- 危险操作（DROP/TRUNCATE）需要确认
- 查询超时限制防止长时间占用
- 结果行数限制防止内存溢出

---

## 性能优化 ⚡

### 连接池
- 复用数据库连接
- 空闲连接自动回收
- 连接数限制配置

### 查询优化
- 大表查询自动添加 LIMIT
- 流式读取大数据结果集
- 查询结果缓存

### UI 优化
- 树形视图懒加载
- 虚拟滚动支持大数据量
- 异步加载避免阻塞 UI

---

## 可访问性 ♿

- 支持 VSCode 主题同步
- 键盘快捷键支持
- 屏幕阅读器友好
- 高对比度模式支持

---

## 测试策略 🧪

### 单元测试
- 数据库服务层单元测试
- 工具函数测试
- 数据验证逻辑测试

### 集成测试
- 真实数据库连接测试（Docker 容器）
- CRUD 操作测试
- 事务处理测试

### E2E 测试
- VSCode 扩展 UI 测试
- 用户操作流程测试

---

## 发布与更新 🚀

### 版本规划
| 版本 | 内容 |
|------|------|
| 0.1.0 | SQLite 基础支持 |
| 0.2.0 | PostgreSQL 支持 |
| 0.3.0 | MySQL 支持 |
| 0.4.0 | Redis 支持 |
| 1.0.0 | 正式发布 |

### 发布渠道
- VSCode Marketplace
- Open VSX Registry

---

## 开放问题 ❓

1. 是否需要支持多语言 UI？
2. 是否需要团队共享连接功能？
3. 是否需要查询协作/分享功能？
4. 是否需要内置数据库文档生成？

---

## 后续行动 ✅

- [ ] 创建扩展脚手架
- [ ] 实现 SQLite 基础连接
- [ ] 设计连接配置 UI
- [ ] 实现查询编辑器基础功能
- [ ] 编写扩展 README
- [ ] 准备 Marketplace 发布材料

---

## 参考资料 📖

- [VSCode Extension API 文档](https://code.visualstudio.com/api)
- [Database Client 扩展最佳实践](https://code.visualstudio.com/api/extension-guides/database)
- [现有优秀扩展参考](https://marketplace.visualstudio.com/items?itemName=cweijan.vscode-database-client2)
