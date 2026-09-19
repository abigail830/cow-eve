# Platform 分层架构

`backend/platform` 采用 **DDD 分层思想**组织代码：领域模型与规则在内层，技术细节在外层，对外只暴露稳定的 **composition 公共 API**。

## 目录结构

```
platform/
├── domain/              # 领域层：实体、值对象、领域规则、仓储接口
├── application/         # 应用层：用例编排（无 HTTP/Eve 细节）
├── infrastructure/      # 基础设施：DB、加密、AI SDK、环境配置
├── interfaces/          # 接口适配：Eve/HTTP 相关适配器
├── composition/         # 组合根：依赖装配 + 对外公共 API
├── data/                # 本地运行时数据（无 DATABASE_URL 时的 fallback）
└── ARCHITECTURE.md
```

## 依赖规则

| 层 | 可依赖 | 禁止依赖 |
|----|--------|----------|
| **domain** | 同层 domain 模块 | application / infrastructure / interfaces |
| **application** | domain | interfaces；尽量不直接依赖 infrastructure 实现（通过 composition 注入的默认实例除外） |
| **infrastructure** | domain | application / interfaces |
| **interfaces** | application、domain、infrastructure/config | 禁止承载业务规则 |
| **composition** | 全部层 | 被 domain 依赖 |

Agent 通道、Hooks 等 **Eve 入口** 应只 import：

```ts
import { ... } from "#platform/composition/public-api.js";
```

## 各层职责

### domain

- **auth**：用户实体、JWT 领域常量
- **registry**：Agent 目录实体
- **settings**：模型配置实体、预设、校验与合并规则；`ModelSettingsRepository` 接口
- **chat**：会话/事件类型、标题推导等领域逻辑；`ChatRepository` 接口

### application

- **auth/login.use-case**：登录用例（凭证校验 + 签发 token）
- **settings/model-settings.use-case**：读取/更新模型配置、公开 DTO 转换
- **chat/chat.use-case**：会话列表、详情、软删、流式事件持久化

### infrastructure

- **persistence/database**：Drizzle schema、Neon client、migrations
- **persistence/chat**：`DrizzleChatRepository`
- **persistence/settings**：`DrizzleModelSettingsRepository`（Neon + 本地文件 fallback）
- **crypto**：AES-GCM 密钥加解密
- **config**：`JWT_SECRET`、CORS 等环境变量
- **ai**：Eve `defineDynamic` 与 OpenAI-compatible provider 桥接

### interfaces

- **eve/platform-auth.adapter**：Eve channel 的 JWT/CORS 配置

### composition

- **deps.ts**：仓储与基础设施单例
- **public-api.ts**：平台对外稳定导出（Agent 代码唯一推荐入口）

## 扩展指南

1. 新业务先从 **domain 实体 + 仓储接口** 开始
2. 在 **application** 添加用例函数
3. 在 **infrastructure** 实现仓储
4. 在 **composition/public-api.ts** 导出给 Eve 通道
5. **禁止** 在 `agents/**` 中直接 import `infrastructure/**` 或 `domain/**` 内部路径（除 public-api 已导出项）
