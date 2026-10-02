# 1 背景与目标

## 1\.1 为什么要做

过去一年，agent 形态从"单一 LLM 对话"快速演进为"可调用工具、可生成代码、可在隔离环境里执行任务"的运行实体。但对内部研发来说，可用形态仍然是离散的：本地终端里跑一个 CLI agent，IDE 里装一个编辑器 agent，平台侧可能再挂一个 chatbot——彼此之间没有统一入口，工具、技能和工作产物互不打通，团队难以把"使用 agent"沉淀成稳定能力。

我们需要一个内部 Agent 平台，把 agent 从个人工具变成团队可调用的运行态：用户可以直接找到某个专精 agent，也可以不知道该找谁时交给一个统一入口去调度；新能力通过配置而非改代码即可叠加；外部成熟的 agent 形态能够低成本接入。这一选择的核心是把 Vercel EVE 作为基座——它在 serverless 环境里提供 filesystem-first 的 agent runtime 原生能力（默认独立 sandbox、按相关性加载的 Skill、可打包的 Extension），让我们可以把精力集中在平台自身的多 agent 编排与 A2A 接入上，而不必重新发明 runtime。

本文档是该平台 v1 阶段的高阶需求基线，用于在研发、产品、运维之间对齐目标、能力边界与里程碑。

## 1\.2 我们要解决什么问题

从使用者的视角，v1 必须解决以下问题：

- **入口分散与调度缺失**：团队内同时存在多个可用 agent，用户既需要"我知道找谁"的直连入口，也需要"我不知道找谁"的统一入口。后者由 omni-agent 承担：自带 skill 即可独立完成的任务直接完成；否则通过 A2A 调度其他专精 agent 或外部 agent。
- **能力扩展依赖改代码**：传统做法每加一项能力都要改动 agent 实现并发布。平台要求任何 agent 都能通过配置 Skill（Markdown playbook，按相关性加载）或 Extension（打包 tools / connections / skills / instructions / hooks 的扩展）完成能力升级，做到运行时即可生效。
- **外部 agent 接入成本高**：OpenCode、Cursor agent 等外部形态各有一套协议，逐一适配会拖累平台演进。平台在 v1 引入通用的 Agent Adapter 抽象层，把"如何调用一个外部 agent"沉淀为统一契约，外部 agent 以适配器形式接入，新增接入方时只需实现对应 Adapter。
- **运行边界不可控**：agent 生成代码、访问资源、执行命令，必须有清晰的隔离与权限边界。平台基于 EVE 提供的独立 sandbox 作为隔离基础，把"运行时安全"作为一等约束写进平台默认行为。

围绕这些问题，v1 设定的成功标准是：用户可以以最少配置在平台上获得"直连专精 agent / 通过 omni 调度 / 通过配置升级能力 / 通过 Adapter 接入外部 agent"四条核心路径，并能在 Vercel serverless 环境稳定运行。

## 1\.3 不做什么与范围边界

v1 明确不做以下事情，以保持实现边界可控：

- **不做多 EVE 实例水平扩展做容量**：v1 部署粒度 = 一个 EVE 实例承载多个 agent。多副本与跨实例调度不进入 v1 范围。
- **不做 Project 抽象**：用户提到"用类似 project 的概念组织过程和生成物"，v1 不引入 Project 抽象。多 agent + A2A 跑通后，Project 作为后续里程碑单独定义。
- **不做自有 plugin DSL**：配置态直接复用 EVE 的 Skill / Extension 形态，不另造一套插件语言。
- **不做重型任务执行**：omni-agent 承担调度 + 自带 skill 完成轻量任务，重型任务通过 A2A 派发给专精或外部 agent。
- **不做开源 / 商业化决策**：本文不替用户讨论开源策略、收费模式或对外品牌。
- **不下沉到 API 协议与代码实现**：本文仅覆盖高阶需求，API 字段、错误码、模块实现细节留给后续设计文档。

写作范围边界也由此确立：本文用产品需求与架构视角描述"做什么、为什么、做到什么程度"，不替代接口规格、运维手册或测试用例文档。

# 2 目标用户与场景

## 2\.1 开发者画像

平台面向三类内部用户。所有画像默认在 Vercel serverless 环境内运行，使用浏览器、终端或 IDE 作为入口。

- **平台用户（Agent 调用方）**：内部研发与产品同事，需要在日常工作中调用 agent 完成任务，例如代码生成、代码评审、文档草拟、数据查询、流程串联。他们关心的不是 runtime 实现，而是"我能用谁、它能做什么、它跑得稳吗"。
- **agent 维护者（Skill / Extension 作者）**：负责编写 Markdown 形式的 Skill playbook，或把一组 tools / connections / skills / instructions / hooks 打包成 Extension。他们关心的是配置表达力、运行时加载行为、与平台既有契约的兼容性。
- **平台接入方（Adapter 作者）**：负责把外部 agent（如 OpenCode、Cursor agent 等）接入平台，需要按 Agent Adapter 抽象实现适配器。他们关心调用契约、鉴权方式、产物回传与错误处理。

三类用户的角色与日常动作存在交集：同一个人可能今天调用 agent，明天给某个 agent 加一个 Skill，下周又负责把一个新的外部 agent 接进来。平台需要在文档、配置格式、错误信息上对三类用户保持一致口径，减少切换成本。

## 2\.2 关键场景与用户故事

以下用户故事覆盖 v1 必须能跑通的四条主路径。每条故事都对应到第 4 章的核心能力小节。

- **直连专精 agent**：作为平台用户，我希望直接调用某个明确擅长某类任务的 agent（例如"代码评审 agent"），跳过 omni-agent，由平台把它路由到对应 agent runtime。
- **统一入口调度**：作为平台用户，当我无法判断该用谁时，我把请求交给 omni-agent；它要么用自己的 skill 直接完成，要么把子任务派给一个或多个专精 agent / 外部 agent，并把结果汇总回我。
- **配置态升级能力**：作为 agent 维护者，我不需要改 runtime 代码，只要新增或更新一个 Skill（Markdown playbook）或安装一个 Extension（EVE plugin），目标 agent 就能在下次调用时获得新能力。
- **接入外部 agent**：作为平台接入方，我按 Agent Adapter 抽象实现一个新的适配器，把某个外部 agent（如 OpenCode）注册进平台运行态，使其可被 omni 或其他专精 agent 调用。

辅助场景同样需要 v1 覆盖：

- **失败可观测**：任何一次调用都应留下调用链、输入输出摘要与错误上下文，方便事后排查。
- **隔离不串扰**：agent 之间的工作目录、生成的中间产物应彼此隔离，互不可见。

用户故事不规定具体字段与错误码，相关细节由接口设计文档承担。

# 3 市场与竞品参考

## 3\.1 Vercel EVE 作为基座

平台选择 Vercel EVE 作为基座框架，原因在于它在 serverless 环境里直接提供了 agent runtime 应有的核心能力：filesystem-first 的执行模型、按相关性加载的 Skill、可打包复用的 Extension、以及默认独立的 sandbox 隔离。我们不必重新实现 runtime，可以把精力集中在多 agent 编排与 A2A 接入这两件平台自己的事上。

- **框架定位**：EVE 是一个面向 agent 的 filesystem-first 框架，把文件系统作为 agent 与外部世界交互的主要载体，工具调用、上下文读写与产物沉淀都以文件路径为统一抽象 。
- **能力总览**：官方页面描述了 EVE 作为 agent runtime 提供的核心能力，包括 sandbox、Skills、AI Gateway、Workflows、Connect 等内建组件 。
- **引入文章给出的关键事实**：每个 agent 默认拥有独立 sandbox，agent 生成的代码与应用运行时隔离 。这一事实直接对应本平台对"运行边界不可控"问题的解法。
- **Skill 的形态**：Skill 是按相关性加载的 Markdown playbook，agent 在执行时根据当前任务挑选合适的 Skill 注入上下文 。
- **Extension 的形态**：可以把 tools、connections、skills、instructions、hooks 打包成可安装扩展 。

这五条事实合起来给出了平台的扩展面与隔离面：Skill 负责表达"agent 怎么做事"，Extension 负责把一组相关资产打包分发，sandbox 负责确保 agent 之间不串扰。这三点也是第 4 章"配置态：Skill 与 Extension"小节的直接依据。

## 3\.2 开发者用 agent 对标：Codex CLI、Cursor

开发者侧已经有相对成熟的 coding agent 形态，是我们设计平台时直接对标的参考。

- **Codex CLI**：开源、面向终端本地运行的 coding agent，强调开发者直接在本地 shell 与 agent 协作  。它代表"开发者用 agent"这一类形态的核心心智：终端可达、命令式交互、本地工作目录即上下文。
- **Cursor 2.0**：编辑器侧的 agent 形态，单一 prompt 可并行起多个 agent，使用 git worktree 或远端机器做工作空间隔离 。它说明"多 agent 并行 + 工作空间隔离"在开发者体验中是可行且有需求的形态。

对平台的启示：

- 我们要支持"开发者直接调用某个专精 agent"这一入口，而不是把所有交互都藏在 omni-agent 之后。
- 多 agent 并行是有真实场景的，但 v1 不做多 EVE 实例水平扩展；并行由单个 EVE 内的多 agent runtime 通过配置与调度承担。
- 工作空间隔离这件事由 EVE 的 sandbox 默认提供，平台不再额外发明隔离机制。

这两个对标还共同暗示了一个取舍：开发者的本地体验非常依赖"agent 能直接读写本地文件"。在 serverless 平台下我们换一种等价表达——agent 直接读写 sandbox 内的文件——这一点需要写入第 5 章"部署形态"的描述中。

## 3\.3 通用 omni\-agent 对标：WorkBuddy、Grok Bot

通用 omni-agent 形态是平台"统一入口"能力的灵感来源。

- **WorkBuddy**：单 prompt 触发多 agent 并行执行的通用型 omni-agent 形态 。它说明"我不知道该找谁"的入口确实有真实需求：当用户给出复杂任务时，平台需要有能力在内部并行调用多个专精 agent，并把结果聚合回单一回复。
- **Grok Bot**：以单一 bot 形态承载多能力入口 。它说明 omni-agent 本身可以有自己的 skill 集，而不只是一个调度路由器——这与本平台"omni 自带 skill 完成轻量任务，重型任务再 A2A 派发"的定位直接对齐。

对平台的启示：

- omni-agent 不是纯路由器，必须自带 skill，否则用户体验上会出现"什么都要绕一圈"的尴尬。
- 单 prompt 多 agent 并行是合理形态，平台在 v1 不做水平扩展，但应保证 omni 在单个 EVE 实例内能调度多个 agent 并行工作。
- 与通用型 omni-agent 产品不同，本平台是内部工具，omni-agent 的 skill 与扩展由内部维护者持续补充，而不是面向生态开放，这一点要在文档中清楚传达。

## 3\.4 协议与生态：MCP

MCP（Model Context Protocol）已成为 agent 工具与上下文集成的事实标准  。平台在 v1 不绑定 MCP 作为唯一协议，但必须把它作为外部生态对接时的默认兼容面。

对平台的启示：

- **默认遵循**：平台对外暴露的能力——尤其是 Agent Adapter 抽象层——应能容纳基于 MCP 的工具/资源/上下文协议，不必为每个外部 agent 重写协议栈。
- **避免被绑架**：MCP 是默认而非唯一。当某个外部 agent 采用更合适的自有协议时，Adapter 抽象层要能容纳，不强制所有接入方都翻译成 MCP。
- **观察后续演进**：MCP 在一年内成为事实标准 ，平台在 v1 设计 Agent Adapter 抽象时，要把"协议可替换"作为契约之一，避免日后协议迁移成本过高。

MCP 与本平台能力的关系留到第 4.4 节 A2A 接入与第 5 章系统视图中具体描述，本节仅作为生态背景。

## 3\.5 我们借鉴什么、避免什么

经过前四节的轻量调研，把对平台 v1 真正有用的部分提炼如下：

**借鉴**

- **EVE 的 filesystem-first 与 sandbox 默认隔离**：直接采用，不另造机制。这是平台运行边界可控的最低成本路径  。
- **Skill / Extension 作为配置态**：沿用 EVE 的两种扩展形态，平台不引入自有 DSL  。
- **直连专精 agent + omni 统一入口并存**：参考 WorkBuddy 的多 agent 调度形态，但收窄为内部工具，避免生态化负担 。
- **单 prompt 多 agent 并行**：在单个 EVE 实例内通过调度与配置实现，不做多实例水平扩展。
- **外部 agent 接入走统一抽象**：参考 Cursor 2.0 多 agent 并行 + 工作空间隔离的设计思路 ，但抽象为 Adapter 层，避免被具体外部协议绑架。
- **以 MCP 为默认协议面**：在生态对接时优先遵循 MCP 。

**避免**

- **过度承诺的 omni-agent 能力**：不像通用型产品那样把 omni 当作"无所不能的总入口"，本平台 omni 的能力范围 = 调度 + 自带 skill 完成轻量任务。
- **多 EVE 实例水平扩展**：v1 不引入副本调度、跨实例状态同步等复杂能力。
- **Project 抽象前置**：用户原话中提到"用类似 project 的概念组织过程和生成物"，v1 不实现，留在后续里程碑，避免一开始就背负过重的领域模型。
- **从零实现 runtime**：所有 runtime 相关能力优先复用 EVE，平台工作集中在编排与接入。
- **开源 / 商业化话题**：本文不替用户讨论。

# 4 核心能力

本章定义平台的四项核心能力。每节按"做什么 / 解决什么问题 / v1 取舍 / 与 EVE 原生机制的关系"四个维度展开，是评审"我们到底做什么"的唯一基准。

- 4.1 多 Agent Runtime：一个 EVE 实例承载多个并列 agent runtime，通过配置区分。
- 4.2 Omni-Agent：统一入口 agent，承担调度 + 自带 skill 完成轻量任务。
- 4.3 配置态：Skill 与 Extension：任何 agent 可通过配置快速升级能力。
- 4.4 A2A 接入与 Agent Adapter 抽象：通过通用 Adapter 抽象层接入外部 agent。

四节共同把"基于 Vercel EVE、多 agent runtime、统一 omni 入口、配置态升级、A2A 接入"五条用户原话诉求落到了具体能力定义上。

本章跨节共用的两张示意图汇总如下，便于读者在阅读具体小节前先建立整体视觉判断：

![多 Agent Runtime 拓扑示意](diagram://f590bc98-f602-4320-88bf-5e2e25ffe82a)

![A2A 调用路径时序图](diagram://e935bbc1-527d-4943-afb1-8bae25031f44)

## 4\.1 多 Agent Runtime

**做什么**：平台在 v1 阶段以"一个 EVE Runtime 实例承载多个 agent runtime"为部署粒度。每一个 agent 都是一个独立的运行时实体，拥有自己的名称、技能集（Skill）、扩展集（Extension）、模型配置和 sandbox 边界，对外以独立身份被调用。用户既可以直接调用某个专精 agent，也可以通过 omni-agent 走统一入口。

**解决什么问题**：解决"agent 数量随团队需求增长，但每个 agent 都单独部署"导致的运维爆炸；同时保留"每个 agent 都是独立运行实体"的清晰语义，让权限、配额、隔离边界可以按 agent 维度管理。

**v1 取舍**（已锁定 one_eve_multi_agent）：

- 部署粒度 = 一个 EVE 实例。多个 agent 通过配置（名称、技能集、扩展、sandbox 边界）区分，不为每个 agent 起独立 EVE 部署。
- 共享 runtime：所有 agent 共用同一个 EVE 实例的基础设施（sandbox 池、AI Gateway、Workflows、Connect 等内建能力），按配置 hot-swap。
- 用户可以直接调用某个专精 agent，绕过 omni-agent；这是平台对"我知道找谁"场景的承诺。
- 不做：多 EVE 实例水平扩展做容量；为同一 agent 提供多份副本；跨实例状态同步。
- 多 agent 并行在单个 EVE 实例内通过调度与配置承担，不引入副本机制。

**与 EVE 原生机制的关系**：每个 agent 默认拥有独立 sandbox ，runtime 的文件系统、Skill 加载、Extension 安装都以 agent 为边界进行隔离 。平台在 EVE 之上提供一层"多 agent 配置与调度"，不替换 sandbox，不替换 Skill / Extension 加载机制。

下图为多 agent runtime 拓扑示意，呈现一个 EVE 实例承载 omni-agent、多个专精 agent 与外部 agent 接入点之间的关系：

![多 Agent Runtime 拓扑示意](diagram://f590bc98-f602-4320-88bf-5e2e25ffe82a)

拓扑要点：

- EVE Runtime 实例是顶层容器；其下并列承载若干 agent runtime。
- omni-agent 与各专精 agent、外部 agent 接入点处于同一并列层级，地位对等。
- omni-agent 对其他 agent 发出有向连线，表达"可调度可达"。
- 专精 agent 之间不连线，强调它们彼此独立、可被独立调用。
- 外部 agent 接入点旁以注释标注"Agent Adapter"，表示它代表抽象接入层（详见 4.4 节）。

## 4\.2 Omni\-Agent

**做什么**：omni-agent 是平台为"我不知道该找谁"场景提供的统一入口 agent。它本身就是一个 EVE agent runtime，承载两类职责——调度与自带 skill 完成任务。当用户提交请求时，omni-agent 先判断任务是否能由自身 skill 集合完成；若能，直接完成并返回；若不能，把任务拆解后通过 A2A 调度一个或多个专精 agent / 外部 agent 完成，再把结果汇总回用户。

**解决什么问题**：解决"团队内 agent 数量变多后用户难以选择入口"的体验问题；同时承担"分发 + 自完成"的双重职责，避免 omni 退化为一个空壳路由器。

**v1 取舍**（已锁定 omni_with_skill）：

- omni-agent 的能力范围 = 调度 + 自带 skill 完成的轻量任务。
- omni-agent 不承担重型任务执行；重型任务一律通过 A2A 派发。
- omni-agent 不做独立部署形态：它与专精 agent 同处一个 EVE Runtime 实例，使用同一套配置与运行时基础设施（详见 4.1 节）。
- omni-agent 与其他 agent 之间使用统一调度接口，不为 omni 单独开放特权路径。

**与 EVE 原生机制的关系**：omni-agent 复用 EVE 的 Skill 加载机制：自身可加载一组 Skill playbook，用于处理"我自己就能完成"的轻量任务；调度的实现基于 EVE 的 Workflows 编排能力，而非另写一套调度引擎。当 omni 通过 A2A 调用其他 agent 时，调用契约由第 4.4 节定义的 Agent Adapter 抽象层承载，omni 不感知下游 agent 的具体协议。

omni-agent 与专精 agent 在运行时拓扑中的关系如 4.1 节拓扑图所示：与所有 agent 并列，可对其他 agent 发出调度。

## 4\.3 配置态：Skill 与 Extension

**做什么**：平台允许任何 agent（专精 agent 或 omni-agent）通过加载 Skill 或安装 Extension 来获得新能力，无需修改 runtime 代码。Skill 是 EVE 中按相关性加载的 Markdown playbook ；Extension 是把 tools、connections、skills、instructions、hooks 打包后的可安装扩展 。

**解决什么问题**：解决"agent 每加一个能力都要改代码并发布"的开发体验问题，让平台使用者与 agent 维护者都可以通过配置文件升级 agent 的能力集合。

**v1 取舍**：

- 沿用 EVE 原生的 Skill / Extension 形态，不发明自有 plugin DSL。
- 配置变更通过运行时生效，热加载边界以 EVE 提供的范围为准；v1 不承诺超出 EVE 能力的动态更新行为。
- Skill 的编写格式 = Markdown playbook；Extension 的打包方式 = tools + connections + skills + instructions + hooks 的组合。
- 配置变更的可观测性：v1 要求配置变更后能在观测面板区分"配置驱动的新行为"与"代码 bug 导致的行为变化"，便于问题定位。

**与 EVE 原生机制的关系**：Skill 加载由 EVE runtime 按"相关性"在调用时挑选并注入上下文 ；Extension 的安装相当于把一组资产作为整体注册到 agent runtime 的命名空间下 。平台不替换这两条机制，只在其上提供配置组织与变更流程——例如：把多个 Skill 收编成"该 agent 的能力包"，把 Extension 收编成"该 agent 的扩展清单"。

这条机制在内部演进路径上的位置：v0.1 阶段完成"读取已写好的 Skill / Extension 配置并加载"，v0.5 阶段加上"运行时变更配置并热加载"，v1.0 阶段提供完整的"配置版本化 + 变更审计"。具体里程碑在第 8 章定义。

## 4\.4 A2A 接入与 Agent Adapter 抽象

**做什么**：A2A（Agent2Agent）能力让平台可以把外部 agent 接入运行态，被 omni-agent 或专精 agent 统一调用。v1 不直接对接每个外部 agent 的协议，而是引入 Agent Adapter 抽象层：先定义"如何调用一个 agent"的统一调用契约，再为不同外部 agent（OpenCode、Cursor Agent 等）实现各自的 Adapter 适配器。

**解决什么问题**：解决"每个外部 agent 都用一套私有协议，逐一对接会让平台被绑架，且每次接入都是一次大工程"的问题。抽象层让新增外部 agent 变成"实现一个 Adapter"，而不是"改平台核心"。

**v1 取舍**（已锁定 open_general / skip_project）：

- 采用通用 Agent Adapter 抽象层：先抽象接口，再为不同外部 agent 实现适配器。
- 不绑定 OpenCode / Cursor Agent 的具体协议；外部 agent 以 Adapter 形式加入运行态。
- Adapter 抽象层默认对 MCP 友好  ：当某个外部 agent 采用 MCP 时，Adapter 直接以 MCP 协议翻译；当某个外部 agent 使用自有协议时，Adapter 自行翻译为平台统一调用契约。
- v1 不抽象 Project 概念：用户原话提到"用类似 project 的概念组织过程和生成物"，但 Project 作为领域模型前置会带来过重的设计负担；v1 只完成"接入与调用"，Project 作为后续里程碑单独定义。
- 不做：把外部 agent 调度结果沉淀到 Project 视图；组织多 agent 协作的过程产物；这些留到 Project 抽象出现后处理。

**与 EVE 原生机制的关系**：Agent Adapter 抽象层不依赖 EVE 的 Skill / Extension 形态——Adapter 是一个独立的协议适配层，与 EVE runtime 解耦。它的运行位置是 omni-agent 或专精 agent 内部的一段可调用代码，由 EVE 的 Workflows 编排触发。具体实现细节不属于高阶需求范围。

下图为一次 A2A 调用的时序路径，呈现调用从用户出发、经 omni-agent、通过 Agent Adapter 抽象层路由到具体外部 agent，再沿对称路径回传的过程：

![A2A 调用路径时序图](diagram://e935bbc1-527d-4943-afb1-8bae25031f44)

时序要点：

- 用户请求先到 omni-agent；omni 自行判断是否能完成，不能则发起 A2A 调用。
- A2A 调用走"统一调用契约"，不直接落到具体外部 agent 的协议上。
- Agent Adapter 抽象层根据路由结果，把请求分发到具体 Adapter（OpenCode Adapter / Cursor Agent Adapter）。
- 具体 Adapter 负责把统一调用契约翻译为对应外部 agent 的协议（OpenCode 协议 / Cursor Agent 协议），与该外部 agent 交互。
- 产物沿对称路径回传：外部 agent → Adapter → omni-agent → 用户。
- 这一路径让"新增外部 agent"等价于"新增一个 Adapter"，平台核心代码不变。

# 5 架构总览

## 5\.1 系统视图

平台在系统视图上呈现为以下分层，从用户入口到外部 agent 依次排列：

- **用户入口层**：API（v1 主入口）以及后续规划中的 CLI；用户提交请求时既可指定专精 agent 名称直连，也可不指定、由 omni-agent 接收并调度。
- **Agent Runtime 层**：omni-agent 与若干专精 agent 共处一个 EVE Runtime 实例，按配置区分；该层是平台核心，承载 Skill 加载、Extension 安装、sandbox 隔离与 Workflows 编排。
- **Agent Adapter 抽象层**：A2A 调用的统一入口，对外暴露"调用一个 agent"的统一契约，把请求路由到具体外部 Adapter（OpenCode Adapter、Cursor Agent Adapter 等）。
- **外部 Agent 层**：被 Adapter 适配后的 OpenCode、Cursor Agent 等外部 agent runtime；它们对平台其他层不直接可见，只能通过 Adapter 与平台交互。
- **配置与资产层**：Skill 仓库、Extension 包、Agent 配置文件——所有 agent runtime 与 Adapter 都从这里加载配置。
- **平台基础设施层**：复用 Vercel 内建的 AI Gateway（模型路由与计量）、Sandboxes（隔离边界）、Workflows（编排）、Connect（外部系统连接）。平台不重写这些能力，只在其上做平台特性。

复用面与替换面的关系清晰：平台基础设施层全部由 Vercel EVE 提供；Agent Adapter 抽象层与配置与资产层由平台自建；Agent Runtime 层在 EVE 之上做"多 agent 配置与调度"包装；用户入口层由平台对外暴露契约。

## 5\.2 关键流程

平台运行围绕三条关键流程。每条流程都用自然语言概述参与者与顺序；其中 A2A 调用的详细时序已由第 4.4 节图承载，本节不再重复绘制。

**流程一：用户直连专精 agent**

1. 用户通过入口层发起请求，明确指定目标 agent 名称。
2. 入口层按 agent 名称路由到对应 agent runtime（同一 EVE 实例内）。
3. 目标 agent 加载自身 Skill / Extension 集合，在自身 sandbox 内执行。
4. 结果沿原路径回传至用户。

要点：入口层不做 omni 路由，跳过 omni-agent；目标 agent 拥有独立 sandbox，过程与其他 agent 不串扰。

**流程二：用户经 omni-agent 提交任务**

1. 用户通过入口层发起请求，未指定 agent。
2. 入口层将请求交给 omni-agent。
3. omni-agent 先评估能否由自身 skill 完成：
   - 能完成：直接执行并回传。
   - 不能完成：拆解为子任务，依次或并行通过 A2A 调用其他专精 agent 或外部 agent。
4. omni-agent 汇总子任务结果，按统一格式回传至用户。

要点：调度路由（专精 vs 外部）由 omni 决定，调用契约由 Agent Adapter 抽象层承载（详见 4.4 节）。外部 agent 的具体协议对 omni 不可见。

**流程三：新增外部 agent 接入**

1. 平台接入方按 Agent Adapter 抽象层定义的统一契约实现一个具体 Adapter（例如 OpenCode Adapter）。
2. Adapter 实现注册到平台运行态，附带配置（鉴权方式、外部 agent 路由信息、产物格式映射）。
3. omni-agent 或专精 agent 即可在后续调用中按 Adapter 名引用该外部 agent。

接入与调用的对称关系保证：新增一个外部 agent = 新增一个 Adapter，平台核心不变。

## 5\.3 部署形态

部署形态直接继承用户的核心约束：平台基于 Vercel EVE 架构，跑在 Vercel serverless 环境。

**部署对象**：一个 EVE Runtime 实例。多个 agent（omni-agent + 专精 agent + 通过 Adapter 接入的外部 agent 抽象点）共用同一实例；每个 agent 在实例内拥有独立 sandbox 与配置。

**配置驱动**：

- Agent 列表由配置决定，新增 / 删除 agent = 修改配置 + hot-swap，不需要重新部署实例。
- 每个 agent 的 Skill 集合、Extension 集合、模型配置、sandbox 边界都通过配置声明。

**复用基础设施**：

- Sandboxes：作为 agent 之间的隔离边界，由 EVE 默认提供 。
- AI Gateway：模型路由与计量。
- Workflows：编排 omni-agent 的调度流程。
- Connect：与外部系统（代码托管、知识库、内部工具）的连接。

**v1 明确不做**：

- 多 EVE 实例水平扩展做容量：v1 单实例承载，不做副本与跨实例调度。
- 自有 K8s / 容器平台：完全依赖 Vercel serverless，不引入额外编排层。
- 跨可用区 / 跨地域部署：v1 不涉及多区域，运行边界以 Vercel 环境为限。

**serverless 边界的表达**：开发者使用 agent 的"本地工作目录"心智，对应在 serverless 平台上等价于"agent 自己的 sandbox 文件系统"。每个 agent 的 sandbox 默认不与其他 agent 互通；如需互通，必须通过显式配置（共享挂载点或显式数据传递），而不是默认行为。这一边界既来自 EVE 的默认 sandbox 隔离 ，也是平台对"运行边界不可控"问题的回应。

# 6 非功能需求

## 6\.1 可用性

可用性目标按"调用层 / 平台层 / 外部 agent 层"三个层次分别表达，避免单一指标掩盖不同组件的故障特征。

**调用层（用户可见）**：用户提交请求到收到响应的端到端成功率目标 ≥ 99%（以单实例月度计）。失败模式按用户能感知的方式分类：超时、明确错误、未知错误三类，每类需在响应中携带可定位信息（请求 ID、阶段、错误码）。

**平台层（EVE Runtime + 编排 + Adapter）**：平台内部组件失败不应造成整个 EVE 实例不可用——单个 agent 的 sandbox 失败不影响其他 agent；单个 Adapter 失败不影响 omni-agent 自完成路径。

**外部 agent 层**：外部 agent 不可用时，omni-agent 应能优雅降级（提示用户、改派其他 agent、或仅返回已完成的子任务结果），而不是直接抛出底层错误。

**故障恢复**：v1 范围内不承诺自动跨实例迁移；故障恢复以"实例内重试 + 配置热加载"为基本手段，重启实例作为兜底。

## 6\.2 可扩展性

可扩展性围绕"agent 数量增长 / 能力扩展 / 协议扩展"三条主线表达。

**agent 数量增长**：v1 范围内，agent 数量增长通过"修改配置 + hot-swap"承担；不做水平扩展。当 agent 数量或单 agent 调用量增长到单实例无法承担时，留待后续里程碑。

**能力扩展**：通过 Skill（Markdown playbook，按相关性加载）与 Extension（打包 tools / connections / skills / instructions / hooks）两条配置化路径扩展能力，不改 runtime 代码。

**协议扩展**：外部 agent 接入通过 Agent Adapter 抽象层承担，新增协议 = 新增 Adapter 实现，平台核心不变。Adapter 默认对 MCP 友好 ；当某个外部 agent 协议演进或替换时，只需替换对应 Adapter。

**契约稳定性**：v1 范围内承诺三项核心契约相对稳定——平台统一调用契约、Agent Adapter 接口约定、agent 配置 schema。具体字段定义留给接口设计文档，但"破坏性变更需要明确版本号"作为通用约束。

## 6\.3 安全

安全约束按"运行边界 / 凭据与权限 / 数据保护 / 外部 agent 接入"四个方面表达。

**运行边界**：每个 agent 默认拥有独立 sandbox ；agent 之间的文件系统默认不互通；越界访问必须通过配置显式声明，不允许默认行为绕过隔离。

**凭据与权限**：v1 范围内承诺：

- 用户调用入口的鉴权与权限最小化（具体身份模型留给接口设计文档）。
- agent 调用外部系统所用的凭据，按 agent 维度配置，不共享全局密钥；凭据的存储由 Connect 等 Vercel 内建能力承担 。
- Agent Adapter 接入外部 agent 时所用的鉴权信息，由 Adapter 自行持有，平台不强制统一托管。

**数据保护**：v1 承诺：

- 调用链与产物的可观测数据按内部合规要求保留与脱敏，具体保留期限由数据合规评审决定。
- 不在 v1 范围内承诺：端到端加密、跨实例数据同步、客户托管密钥（HSM/KMS）。

**外部 agent 接入安全**：

- 接入方需按 Agent Adapter 抽象层提供最小权限声明（允许调用的工具、允许访问的资源、允许写入的目标）。
- 平台不默认信任 Adapter 的输出：对外部 agent 返回的内容做风险标注（在产物中保留来源与协议信息），便于用户判断。
- 任意外部 agent 接入需经过评审流程；评审不通过不允许上线运行态。

## 6\.4 成本

成本按"模型推理 / 平台运行时 / 外部 agent 调用"三类划分。

**模型推理**：由 Vercel AI Gateway 统一计量 ；平台对每个 agent 暴露推理用量统计，便于按 agent 维度核算。v1 不承诺复杂的多模型路由优化。

**平台运行时**：EVE Runtime 实例按 serverless 计费。v1 范围内单实例承载多 agent，不为每个 agent 单独起实例；这是 v1 的核心成本控制手段（参见 4.1 节"共享 runtime"决策）。

**外部 agent 调用**：通过 Agent Adapter 调用外部 agent 产生的费用由对应外部服务的计费规则决定；平台不替外部 agent 议价。平台仅做用量记录与归因（哪个 agent / 哪个用户在哪个时间段调了多少次）。

**v1 不承诺**：

- 精确的每次调用成本预测（外部 agent 计费规则可能变化）。
- 自动成本优化（自动切换到更便宜的模型 / 自动合并调用）。

成本相关的具体阈值与告警策略由运维文档承担；本文档仅说明成本结构与控制手段。

## 6\.5 观测

观测围绕"调用链 / agent 行为 / 配置变更"三条主线。

**调用链**：

- 每次用户请求都应产生一条调用链（trace），覆盖：入口层 → omni / 专精 agent → Agent Adapter → 外部 agent。
- 调用链携带统一请求 ID；用户在反馈问题时可凭请求 ID 反查到完整轨迹。
- 调用链至少记录：阶段、参与方、起止时间、输入输出摘要、错误（如有）。

**agent 行为**：

- 每个 agent 的关键事件（Skill 加载、Extension 加载、sandbox 启动、子任务派发、产物落盘）需可被观测。
- v1 范围内不承诺 agent 内部 LLM 推理的细粒度回放，但应保留"哪个 Skill 参与了上下文注入"这条关键事实，用于排错。

**配置变更**：

- agent 配置（Skill 列表、Extension 列表、模型配置）变更需可追溯；变更与对应调用行为变化可在观测面板对照查看。

**v1 不承诺**：

- 完整 APM（应用性能管理）能力；按需逐步引入。
- 多实例聚合视图；v1 单实例视角足够。
- 用户侧自服务观测面板；v1 范围先满足内部排错需要。

# 7 关键决策与开放问题

## 7\.1 已锁定的关键决策

v1 阶段已锁定的关键设计决策如下。这些决策是评审后续设计与实现的基准，原则上不接受在 v1 范围内重新打开；如需调整，应作为新决策显式记录并替换。

- **D1 多 agent runtime 部署粒度 = 一个 EVE 实例**（one_eve_multi_agent）
  - 决策：一个 EVE Runtime 实例承载多个 agent，通过配置区分（名称、技能集、扩展、sandbox 边界）。
  - 理由：部署粒度 = 一个 EVE，运维简单、共享 sandbox 基础设施、按配置 hot-swap 即可。
  - 边界：不引入多实例水平扩展；不提供同 agent 多副本；并行由单实例内多 agent 调度承担。

- **D2 A2A 接入采用通用 Agent Adapter 抽象层**（open_general）
  - 决策：先抽象"调用一个 agent"的统一调用契约，再为不同外部 agent（OpenCode、Cursor Agent 等）实现具体 Adapter。
  - 理由：避免一开始就被外部 agent 的具体协议绑架，留出适配空间，新增外部 agent = 新增 Adapter。
  - 边界：不为某一家外部 agent 单独优化路径；Adapter 默认对 MCP 友好，但不强制所有接入方使用 MCP。

- **D3 omni-agent 职责范围 = 调度 + 自带 skill**（omni_with_skill）
  - 决策：omni-agent 本身是 EVE 上的一个 agent，承担调度 + 自带 skill 完成轻量任务的双重职责。
  - 理由：避免 omni 退化为空壳路由器；保留"统一入口也能直接办事"的用户体验。
  - 边界：omni 不承担重型任务执行；与专精 agent 同 runtime、统一调度接口，不做独立部署形态。

- **D4 v1 不抽象 Project 概念**（skip_project）
  - 决策：v1 不引入 Project 领域模型；多 agent + A2A 跑通后，Project 作为后续里程碑单独定义。
  - 理由：Project 作为领域模型前置会带来过重的设计负担；先把核心编排与接入做穿，再处理过程产物的组织。
  - 边界：本决策不阻塞用户使用"类似 project 的概念"组织过程和生成物——v1 仅是不内置抽象，使用者仍可通过外部工具或人工约定满足这一需求。

四条决策共同确定了 v1 的能力边界：多 agent 共 runtime、Adapter 解耦外部协议、omni 自带 skill 完成轻量任务、Project 留给后续里程碑。任何与上述决策冲突的实现方案在 v1 范围内不予接受。

## 7\.2 开放问题与待澄清

以下问题在 v1 范围内仍需进一步明确或评审，但不影响当前文档已经成立的核心能力定义。问题以"业务命题"形式记录，便于后续在评审会或里程碑评审中集中收敛。

- **Q1 用户身份与权限模型**：当前文档承诺"调用入口按鉴权与权限最小化"，但具体的身份提供方（内部 SSO、API Key、临时 Token）、权限粒度（按 agent / 按 Skill / 按资源）尚未确定。这是接口设计文档需要首先收敛的事项。

- **Q2 外部 agent 接入评审标准**：第 6.3 节提到"外部 agent 接入需经过评审流程"，评审标准的具体维度（合规、协议稳定性、调用频次上限、产物格式、回滚手段）需要独立文档承载。

- **Q3 omni-agent 的 skill 集合治理**：omni 自带 skill 的增加会带来"什么该由 omni 自己完成、什么该派给其他 agent"的边界漂移。v1 范围内是否需要为 omni 的 skill 集合设立准入与撤销流程，需要在 v0.5 阶段确认。

- **Q4 配置变更的灰度与回滚**：第 4.3 节提到配置变更可热加载；变更的灰度策略（金丝雀、按 agent 灰度）与回滚手段需要在 v0.5 阶段落到运维文档。

- **Q5 调用链的统一 ID 与跨平台对齐**：第 6.5 节提到统一请求 ID，但请求 ID 的生成规则、与上下游系统的传递约定需要与可观测性平台对齐。

- **Q6 Project 抽象何时启动**：作为已锁定决策 D4 的反向问题——在哪个里程碑开始定义 Project 抽象、抽象覆盖到什么程度（过程视图 / 产物视图 / 协作视图），需要单独讨论。本文档仅承诺"v1 不做"，不做 Project 的进一步定义。

- **Q7 用户入口形态**：v1 主入口是 API；CLI 与其他入口形态（IDE 插件、聊天工具集成）是否进入 v1 路线图尚未决定。

后续随着 v0.1 / v0.5 / v1.0 三个里程碑的推进，上述问题应在对应里程碑评审会上被明确收敛或显式延后。

# 8 里程碑

## 8\.1 v0\.1 最小可跑

**目标**：在 Vercel serverless 环境内把"一个 EVE 实例 + omni-agent + 一个专精 agent + 一个 Adapter 接入的外部 agent"端到端跑通，作为后续能力的验证基线。

**能力清单**：

- 一个 EVE Runtime 实例已部署；实例内承载 omni-agent 与一个示例专精 agent。
- omni-agent 自带最少一个 Skill playbook，能独立完成一类轻量任务（例如单文件代码评审）。
- 用户直连专精 agent 的路径可走通（输入 → 输出）。
- 用户经 omni-agent 提交任务，由 omni 自带 skill 完成或派发到专精 agent 的路径可走通。
- Agent Adapter 抽象层有一个最小实现 + 一个示例 Adapter（OpenCode Adapter 或 Cursor Agent Adapter，二选一即可）。
- 基础调用链记录（请求 ID、阶段、起止时间）已落地。

**验收口径**：

- 用户从入口层提交请求，最坏情况下能在合理超时内收到响应；失败模式按可用性章节（6.1）的三类错误形式呈现。
- omni-agent 与专精 agent 的 sandbox 隔离已被验证：在一个 agent 内修改 sandbox 文件不影响另一 agent。
- Adapter 调用示例外部 agent 至少完成一次"提交任务 → 收到结果"的端到端验证。
- 关键能力边界符合第 7.1 节四条已锁定决策，没有出现与决策冲突的实现。

**不在 v0.1 范围**：配置热加载、Skill / Extension 完整治理、调用链细节、性能与成本观测、外部 agent 多接入并行。

## 8\.2 v0\.5 能力初齐

**目标**：在 v0.1 的基础上扩展到"多 agent + 多 Adapter + 配置态 + 基础观测"完整组合，覆盖核心能力章节（4.1—4.4）的全部条目，并能在内部试用。

**能力清单**：

- 多 agent runtime 已具备：omni-agent + 至少 3 个专精 agent 在同一 EVE 实例内运行；agent 列表通过配置驱动，支持 hot-swap。
- Skill / Extension 配置化升级能力已在 v0.1 的基础上扩展：
  - 至少 2 个 Skill playbook 被实际使用；
  - 至少 1 个 Extension（含 tools / connections / skills / instructions / hooks 的组合）被安装并生效；
  - 配置变更可热加载（以 EVE 支持的范围为限）。
- A2A 接入扩展到至少 2 个 Adapter：例如 OpenCode Adapter + Cursor Agent Adapter，并具备在 omni 与专精 agent 之间的双向调用能力。
- 观测能力补齐：调用链覆盖入口 → omni → 专精 agent → Adapter → 外部 agent 的完整轨迹；agent 关键事件（Skill 加载、Extension 加载、sandbox 启动、子任务派发）可观测。
- 基础安全机制落地：调用入口鉴权与权限最小化、外部 agent 接入评审流程启动、按 agent 维度的凭据配置。

**验收口径**：

- 核心能力四节（4.1—4.4）所述"做什么"全部成立；每条都至少有一个可演示的内部场景。
- 配置变更与对应行为变化在观测面板中可对照。
- 7.2 节开放问题中 Q1 / Q2 / Q4 收敛到接口或运维文档初稿。
- 性能与稳定性不作为本里程碑验收阻塞项，但应在评估报告中记录基线数据。

**不在 v0.5 范围**：Project 抽象、多 EVE 实例水平扩展、对外部用户的开放访问。

## 8\.3 v1\.0 对外可用

**目标**：平台 v1.0 形态达到"对外可用"基线：能力齐备、观测完整、文档与运维流程就绪，可面向内部全量研发用户开放。

**能力清单**：

- 多 agent runtime 稳定承载预期数量的 agent：omni-agent + 完整专精 agent 集合在同一 EVE 实例内按配置驱动运行；agent 配置版本化（变更可审计、可回滚）。
- Skill / Extension 配置化升级能力成熟：Skill playbook 与 Extension 包具备命名空间管理；变更按灰度策略生效；变更审计与回滚手段可用。
- A2A 接入稳定：通用 Agent Adapter 抽象层契约冻结；至少 2 个外部 Adapter 长期可用（OpenCode Adapter + Cursor Agent Adapter），并具备新增 Adapter 的清晰流程。
- 观测完整：调用链、agent 行为、配置变更三类数据在统一面板可查；与可观测性平台对齐的统一 ID 规则已生效。
- 安全合规：身份与权限模型按 7.2 节 Q1 收敛结果落地；外部 agent 接入评审流程持续运行；数据保护与脱敏符合内部合规要求。
- 运维就绪：成本观测按 6.4 节结构落地；告警与值班流程在运维文档中明确。

**验收口径**：

- 全量内部研发用户可自助使用平台，平台稳定性满足 6.1 节可用性目标（调用层端到端成功率 ≥ 99%）。
- 7.2 节七项开放问题全部收敛（Q6 Project 抽象明确"v1 不做"，其他六项有明确答案或写在后续路线图中）。
- 已锁定决策四条（7.1 节）全部兑现；如出现调整，需作为新决策显式记录。
- 接口文档、运维文档、用户使用文档齐备，可独立支撑日常使用与排错。

**不在 v1.0 范围**：Project 抽象、多 EVE 实例水平扩展、对内部以外用户的开放访问、开源与商业化。这些都进入后续里程碑或独立讨论。

# 9 附录

## 9\.1 术语表

**EVE**：Vercel 推出的 filesystem-first 框架，作为本平台的 agent runtime 基座。本文中"EVE"既指框架本身，也指一个具体的 EVE Runtime 实例部署。

**EVE Runtime 实例**：平台上一次具体部署的 EVE 运行环境。v1 范围内一个 EVE 实例承载多个 agent runtime，通过配置区分；不做多实例水平扩展。

**Sandbox**：每个 agent 默认拥有的独立执行环境，承载 agent 生成代码与运行时隔离 。agent 之间的 sandbox 默认不互通。

**Skill**：EVE 中按相关性加载的 Markdown playbook 。Skill 用于向 agent 注入"如何做事"的指引，可在不修改 runtime 代码的情况下扩展能力。

**Extension**：EVE 中把 tools、connections、skills、instructions、hooks 打包后的可安装扩展 。Extension 是平台能力扩展的另一种配置形态。

**Agent**：本平台承载的可独立调用的运行实体。在 v1 范围内分为 omni-agent 与专精 agent 两类；二者地位对等、并列于同一 EVE 实例。

**Omni-Agent**：平台统一入口 agent，承载"调度 + 自带 skill 完成轻量任务"的双重职责（决策 D3）。用户不知道该找谁时，omni-agent 接收请求并决定自完成或派发。

**专精 Agent**：擅长某一类任务的 agent，例如"代码评审 agent"；用户可以直接调用，也可以被 omni-agent 通过 A2A 调度。

**A2A / Agent2Agent**：Agent 与 Agent 之间的调用机制。本平台通过 Agent Adapter 抽象层承接 A2A 调用，避免被具体外部 agent 协议绑架。

**Agent Adapter**：通用 Agent Adapter 抽象层提供的统一调用契约与适配器实现。统一调用契约对调用方（omni 或专精 agent）屏蔽具体外部协议；适配器（OpenCode Adapter、Cursor Agent Adapter 等）负责把契约翻译为具体外部 agent 协议（决策 D2）。

**MCP（Model Context Protocol）**：已成为 agent 工具与上下文集成的事实标准  。平台默认对 MCP 友好，但不强制所有接入方使用 MCP。

**Project（v1 不实现）**：用户原话中提到的"用类似 project 的概念组织过程和生成物"。v1 不抽象 Project 概念（决策 D4），Project 作为后续里程碑单独定义。

**配置变更（Hot-swap）**：agent 列表、Skill / Extension、模型配置等通过配置驱动运行时变更，不需要重新部署 EVE 实例。v1 热加载边界以 EVE 支持的范围为准。

**调用链（Trace）**：覆盖"入口层 → omni / 专精 agent → Agent Adapter → 外部 agent"的统一请求轨迹，用于问题定位与可观测。

## 9\.2 参考资料

本文档在调研与定义过程中引用了以下外部资料，正文中以 `[^refKey]` 形式标注来源。所有引用以用户提供的 URL 为准；URL 稳定性与后续修订由引用维护流程承担。

**Vercel EVE（基座）**

- EVE 仓库：https://github.com/vercel/eve
- EVE 能力总览：https://vercel.com/eve
- EVE 引入文章：https://vercel.com/blog/introducing-eve
- Skill 文档：https://vercel.com/docs/agent-resources/skills
- Extension Changelog：https://vercel.com/changelog/eve-extensions

**开发者侧 coding agent 对标**

- Codex CLI 仓库：https://github.com/openai/codex
- Codex 产品页：https://openai.com/codex/
- Cursor 2.0 Changelog：https://cursor.com/changelog/2-0

**通用 omni-agent 形态对标**

- WorkBuddy：https://www.workbuddy.ai/
- Grok Bot 综述（主参考）：https://www.bleap.finance/en-us/blog/grok-bot-guide-howitworks-pricing-uses
- Grok Bot 综述（补充）：https://netalith.com/blogs/ai-tools/what-is-grok-bot

**协议与生态**

- MCP 一周年综述：https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/
- Wikipedia · Model Context Protocol：https://en.wikipedia.org/wiki/Model_Context_Protocol

**引用规范说明**：本文档以 Markdown 脚注形式给出引用；正式发布前由引用维护流程核对每条 URL 的可达性，并对失效 URL 给出替代或删除处理。
