# OKX Agent Wallet 集成策略调整建议

作者：**Manus AI**  
日期：2026-04-17

## 背景判断

海豚社区 App 的核心定位是 **AI 驱动交易**。在这个前提下，OKX Agent Wallet 与产品目标并不是普通的“可连接钱包”，而更像是适配 AI Agent 的**执行层基础设施**。官方文档明确说明，Agentic Wallet 支持在对话中直接完成**代币兑换、余额查询、转账**等操作，同时 Wallet API 覆盖**查询余额、交易上链、交易历史**，其中“交易上链”进一步支持**Gas 估算、模拟执行、广播交易与订单状态追踪**。[1] [2] [3] [4] [5] [6]

这意味着，当前仓库按“普通钱包集成”思路搭建的外部签名跳转、回调续跑和手动广播链路，并不适合作为未来主路径。它最多只适合作为兼容层或实验兜底层。

## 当前仓库实现与目标模型的差异

| 维度 | 当前仓库实现 | 更适合的 Agent Wallet 模型 |
|---|---|---|
| 钱包心智 | 把钱包视为外部签名器 | 把钱包视为 Agent 原生执行层 |
| 兑换主路径 | 报价后生成待签名交易，再跳转外部签名，再回主线程广播 | 对话中确认后直接调用 Agent Wallet / OnchainOS 能力完成执行 |
| 转账主路径 | 前端构造上下文，等待后续补签名与广播 | 对话确认后直接进入钱包执行能力 |
| 状态管理 | `pending context + callback + resume` 为核心 | `意图识别 + 执行确认 + 官方回执承接` 为核心 |
| 前端职责 | 参与组织签名与广播闭环 | 负责意图承接、卡片展示、确认交互、结果回执 |
| 服务端职责 | DEX API 聚合 + 部分广播 | 统一封装 Agent Wallet / Wallet API / Swap API 的执行编排 |

## 当前仓库中建议降级为兼容层的部分

通过代码复核，当前以下实现都明显建立在“通用钱包签名器”假设上：

| 位置 | 当前作用 | 建议处理 |
|---|---|---|
| `lib/signature-bridge.ts` | 保存待签名上下文、构造回调 URL、解析 signedTx 返回 | 保留为兼容层，不再作为主路径核心 |
| `app/sign/callback.tsx` | 承接外部签名页返回结果并恢复聊天主线程 | 保留为兼容层回调页，仅用于兜底方案 |
| `app/(tabs)/chat.tsx` 中 `startSignatureFlow` / `handleSwapSignature` / `handleTransferSignature` | 组织“去签名”动作与回调恢复 | 主路径应逐步替换为“去确认执行”或“确认交易” |
| `runSwapFlow` 中 `requiresSignature` 分支 | 在 prepared 阶段提示用户跳外部签名 | 应改为 Agent Wallet 风格的确认-执行链路 |
| 签名回调后的 `resumeSignedSwap` / `resumeSignedTransfer` | 在聊天主线程中继续广播和更新回执 | 后续应收缩，只保留兼容模式下使用 |

## 更适合海豚社区 App 的目标架构

### 一、产品主链路

海豚社区 App 的主链路建议收敛为四段：

1. **自然语言意图识别**：用户表达“买入、兑换、转账、筛选代币”等需求；
2. **结构化确认卡片**：展示交易对、金额、路由、价格影响、风险提示；
3. **Agent Wallet 执行确认**：用户在对话中确认，而不是跳外部签名页；
4. **官方能力执行与回执承接**：调用 OnchainOS Wallet / Swap / DeFi 能力返回订单号、广播状态、链上回执，并在聊天主线程中持续更新。

### 二、前后端职责重分配

| 层级 | 建议职责 |
|---|---|
| Chat UI | 展示意图识别、报价、确认卡片、执行状态、订单回执 |
| App 客户端 | 调用本项目服务端封装接口，不直接拼签名/广播细节 |
| 项目服务端 | 统一代理或封装 OKX Agent Wallet / Wallet API / Swap API / DeFi API |
| OKX 能力层 | 负责资产查询、执行模拟、风险控制、广播、订单跟踪 |

### 三、聊天页文案与动作调整建议

| 当前动作 | 建议替换 |
|---|---|
| 去签名 | 确认交易 |
| 发起签名 | 确认转账 |
| 已生成待签名交易 | 已生成执行确认 |
| 已返回签名结果，继续广播 | 已确认执行，正在提交链上交易 |

## 下一轮最值得做的开发动作

### 优先级 P0：把主链路文案与状态语义改正

当前即使底层尚未完全接通 Agent Wallet，聊天主线程也不应再把主路径表述成“外部钱包签名”。第一步可以先在 UI 和状态层面完成去通用钱包化：

| 任务 | 价值 |
|---|---|
| 将“去签名 / 发起签名”改为“确认交易 / 确认转账” | 让产品语言与 Agent Wallet 模型一致 |
| 将 `requiresSignature` 改造成 `requiresConfirmation` 或 `awaitingExecutionConfirmation` | 避免状态语义继续误导开发方向 |
| 将回调恢复文案改为兼容模式说明 | 明确这不是未来默认主链路 |

### 优先级 P1：在服务端抽象新的执行接口

建议新增一层面向聊天主线程的统一接口，例如：

| 接口建议 | 用途 |
|---|---|
| `POST /api/agent-wallet/swap/preview` | 返回报价、价格影响、路由、风险提示、确认所需信息 |
| `POST /api/agent-wallet/swap/execute` | 在用户确认后发起真实执行，返回订单号与状态 |
| `POST /api/agent-wallet/transfer/preview` | 返回目标地址校验、金额摘要、风险提示 |
| `POST /api/agent-wallet/transfer/execute` | 发起真实转账，返回 txHash / orderId / 状态 |
| `GET /api/agent-wallet/orders/:id` | 查询执行进度与链上结果 |

### 优先级 P2：保留兼容层，但不再扩张

当前已经实现的签名桥接工作不需要立刻删除，因为它仍可能在以下场景有价值：

1. 官方 Agent Wallet 移动端集成仍存在接入空白；
2. 某些链路需要兼容传统外部钱包；
3. 测试环境下需要人工校验 signedTx 生命周期。

但后续不建议继续围绕这条链路投入过多主干开发资源。

## 结论

> 对海豚社区 App 而言，**OKX Agent Wallet 不是一个“要接入的钱包”，而是一个“应该成为交易执行主引擎的能力层”**。因此，接下来的工程重点不应继续放在“怎么把通用钱包签名跳转做完整”，而应放在“怎么把聊天主线程、确认交互和 OKX 原生执行能力编排成一个 AI 驱动交易闭环”。

这会让产品方向、技术架构和用户体验三者重新对齐。

## References

[1]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/agentic-wallet "Agentic Wallet | DEX API | DEX API 文档"
[2]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/agentic-quickstart "快速开始 | DEX API | DEX API 文档"
[3]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/run-your-first-ai-agent "搭建你的第一个 AI Agent | DEX API | DEX API 文档"
[4]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/agentic-wallet-skills "Skills | DEX API | DEX API 文档"
[5]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/wallet-api-introduction "钱包 API | DEX API | DEX API 文档"
[6]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/onchain-gateway-api-overview "交易上链 | DEX API | DEX API 文档"

## 六、实现检查点（最新）

当前仓库已经完成首版 **Onchain OS 主路径骨架** 落地，具体包括：

1. 服务端新增 `server/_core/onchain-os.ts`，将既有 dex 报价、执行、订单查询封装为 `config / preview / execute / receipt` 四段式接口；
2. 本地服务新增 `server/_core/onchain-os-routes.ts`，统一挂载 `/api/onchain/config`、`/api/onchain/preview`、`/api/onchain/execute`、`/api/onchain/receipt`；
3. Serverless 侧新增 `api/onchain/index.ts`，与本地服务保持相同的入口语义；
4. 客户端 `lib/_core/api.ts` 已补入 Onchain OS 类型与请求封装；
5. 聊天页 `app/(tabs)/chat.tsx` 已将兑换主路径切到 `previewOnchainSwap / executeOnchainSwap / getOnchainExecutionReceipt`，并把卡片状态从 `requiresSignature` 收敛为 `requiresConfirmation`。

这意味着当前代码已经开始从“通用钱包签名驱动”切换到“AI 对话确认 + Onchain OS 执行承接”的主模型。但也需要明确，底层执行目前仍有一层 **兼容桥接**：`server/_core/onchain-os.ts` 现阶段是对既有 dex-swap 能力的统一语义包装，而不是完全替换为独立的 Agent Wallet 官方 SDK / Skills 实现。换言之，主路径语义已经切换，底层 provider 仍在逐步替换阶段。

### 当前仍保留的兼容层

| 模块 | 当前定位 | 后续方向 |
|---|---|---|
| `lib/signature-bridge.ts` | 兼容旧的签名回调与续跑场景 | 降级为 fallback，不再扩展为主路径 |
| `app/sign/callback.tsx` | 兼容外部签名页回调承接 | 保留，但未来应只服务 fallback 场景 |
| `server/_core/dex-swap.ts` | 当前 Onchain OS facade 的底层 provider | 后续逐步替换为更原生的 Agent Wallet / Onchain OS 实现 |

### 下一步最优先动作

1. 把聊天页中的 `status = prepared / broadcasted / success` 进一步上收为统一的 `phase = preview / awaiting_confirmation / executing / success`；
2. 在服务端新增更明确的资产入口，把 `assets` 也纳入 `/api/onchain/*` 统一语义；
3. 在具备真实项目凭证后，将 facade 底层从兼容 dex provider 逐步替换为更原生的 Onchain OS / Agent Wallet 调用路径。
