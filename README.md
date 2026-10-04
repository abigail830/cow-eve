# Cow Eve — Agent Platform

内部 Agent 平台底座：Vercel Eve（文件即 agent）+ 独立 React 前端。

## 结构

```
cow-eve/
├── docs/                 # 需求文档、平台 icon、agent 头像
├── scripts/              # 统一 start / stop / restart
├── backend/              # Eve agent workspace（omni + research + content-studio）
└── frontend/             # Vite React（登录 + 多 agent 对话）
```

## 快速开始

首次安装依赖：

```bash
cd backend && npm install && cd ../frontend && npm install && cd ..
```

之后用脚本统一启停（无需分别进前后端目录）：

```bash
./scripts/start.sh      # omni :2000 + research :2002 + content-studio :2001 + frontend :5273
./scripts/status.sh
./scripts/stop.sh
./scripts/restart.sh
```

`start` / `restart`（含 backend）会在有 `DATABASE_URL` 时自动执行 `npm run db:migrate`。

也可只操作一部分：`./scripts/start.sh backend` / `frontend` / `omni` / `research` / `content-studio`。

## 已知上游问题（Eve）

Ann Researcher 的 **`research_retrieve`**（`defineWorkflowTool`）在 **多 agent workspace**（`backend/agents/<name>/`，且 member 下**不加** `package.json`）会触发 Eve 的 workflow id 不一致：工具 dispatch 用 `workflow//./agents/research/agent/tools/...`，运行时注册用 `workflow//./agent/tools/...`，报错 *not registered as a workflow*。这是 [vercel/eve#3740](https://github.com/vercel/eve/issues/3740)（P1，open），与 [#3628](https://github.com/vercel/eve/issues/3628) / [PR #3742](https://github.com/vercel/eve/pull/3742) 同一类问题；**0.70.x 仍未官方合入完整修复**。

本仓库采用与 repro 相同的 **multi-agent 无 member package.json** 布局，临时用 **`patch:research-workflow-id`**（build + dev 循环）对齐 id；**不能**靠给 `agents/research/package.json` 规避。另：`research_retrieve` 不再强制 Eve `outputSchema`（弱模型常报 *could not produce a result matching the requested schema*），改为解析 subagent 文本 JSON。见 [backend/README.md](backend/README.md)、[docs/research/RESEARCH_DURABILITY.md](docs/research/RESEARCH_DURABILITY.md)。

配置模型凭证（对话必需）：登录后打开 **Settings → Model**，填写 DeepSeek / Qwen 等 OpenAI 兼容接口的 Base URL、Model ID 与 API Key。

预置账号（无注册）：见 backend `platform/domain/auth/user.entity.ts`（密码 bcrypt 存储）。Platform 分层说明见 `backend/platform/ARCHITECTURE.md`。

## 远端仓库

`git@github.com:abigail830/cow-eve.git`

## 能力底座

- 多 agent 文件配置：`backend/agents/<name>/agent/`
- 登录 JWT → Eve `jwtHmac` 鉴权
- 多轮对话：Eve durable session + `useEveAgent`；会话列表投影到 Neon
- Memory：Upstash Redis（`redisMemory` + `byPrincipal`）
- 定时：omni `schedules/heartbeat.ts`
- Omni → Content Studio：`defineRemoteAgent`

详见 [backend/README.md](backend/README.md) 与 [frontend/README.md](frontend/README.md)。
