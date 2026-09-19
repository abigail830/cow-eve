# Cow Eve — Agent Platform

内部 Agent 平台底座：Vercel Eve（文件即 agent）+ 独立 React 前端。

## 结构

```
cow-eve/
├── docs/                 # 需求文档、平台 icon、agent 头像
├── scripts/              # 统一 start / stop / restart
├── backend/              # Eve agent workspace（omni + content-studio）
└── frontend/             # Vite React（登录 + 多 agent 对话）
```

## 快速开始

首次安装依赖：

```bash
cd backend && npm install && cd ../frontend && npm install && cd ..
```

之后用脚本统一启停（无需分别进前后端目录）：

```bash
./scripts/start.sh      # omni :2000 + content-studio :2001 + frontend :5273
./scripts/status.sh
./scripts/stop.sh
./scripts/restart.sh
```

`start` / `restart`（含 backend）会在有 `DATABASE_URL` 时自动执行 `npm run db:migrate`。

也可只操作一部分：`./scripts/start.sh backend` / `frontend` / `omni` / `content-studio`。

配置模型凭证（对话必需）：登录后打开 **Settings → Model**，填写 DeepSeek / Qwen 等 OpenAI 兼容接口的 Base URL、Model ID 与 API Key。

预置账号（无注册）：见 backend `platform/auth/users.ts`（密码 bcrypt 存储）。

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
