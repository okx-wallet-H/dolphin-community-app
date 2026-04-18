# 海豚社区 App：按 Agent 执行边界重审后的深入代码问题清单

**作者：Manus AI**  
**日期：2026-04-18**

## 一、审查前提

本次深入审查采用你刚刚明确的职责边界：**交易执行层由 Agent 自己与 OKX Swap / Skills 交互，海豚社区 App 不负责直接承担底层交易撮合、签名恢复、广播与订单追踪主职责**。在这个前提下，代码审查的重点不再是“App 是否已经把 Swap API 全部打通”，而是“App 是否仍在越权接管本应属于 Agent 的执行职责，以及 App 是否已经收敛成意图承接、确认交互、状态展示与结果消费层”。

同时，仓库内部此前已有策略文档明确指出：OKX Agent Wallet 更适合作为 **AI Agent 的执行层基础设施**，而不是普通钱包签名器；外部签名跳转、回调续跑与手动广播链路最多只应保留为兼容层或实验兜底层。[1] [2] [3] [4] [5] [6]

## 二、总体判断

当前仓库最核心的问题，不是“少接了几个接口”，而是**主路径职责仍然没有完全从“App 自己做交易”切换到“Agent 做交易，App 只做编排与展示”**。这一点在聊天页、签名桥接层、serverless Onchain 路由、交易持久化骨架以及多份历史交付文档中都能看到一致证据。

更具体地说，当前系统已经在语言层面开始向 Agent Wallet 靠拢，例如把按钮文案收敛成“确认交易”“确认转账”，也引入了统一 `phase` 状态机；但代码主干里仍保存着明显的“前端组织待签名交易 → 回调恢复 → 主线程续跑广播 → 回执轮询”的旧心智。因此，现在最该做的不是继续加深 App 直连执行链，而是把这条直连链正式降级为兼容层，并把真正的主路径抽象成 **Agent 任务协议**。

## 三、按优先级排序的问题清单

### P0：主路径职责漂移，App 仍直接承接交易执行生命周期

`app/(tabs)/chat.tsx` 中的 `runSwapFlow` 仍然直接调用 `previewOnchainSwap(...)` 获取报价，并立刻调用 `executeOnchainSwap(...)` 进入执行。若返回待确认状态，又会把 `swapTransaction`、`broadcastAddress`、Builder Code 相关字段等执行载荷写入卡片与本地待签名上下文，随后在签名回调后由 `resumeSignedSwap` 再次调用 `executeOnchainSwap(...)` 与 `getOnchainExecutionReceipt(...)` 继续广播和轮询。

这意味着聊天页现在不是“把任务交给 Agent 再消费回执”，而是“由 App 自己组织并推进交易生命周期”。按照你的新边界，这是当前最需要优先收敛的架构问题。

| 现象 | 证据位置 | 风险 | 建议 |
|---|---|---|---|
| 聊天页直接发起预览与执行 | `app/(tabs)/chat.tsx` 第 1020–1054 行 | App 越权接管交易主路径，后续容易与 Agent 执行链重复建设 | 将聊天页改为只提交结构化任务给 Agent，不再直接调用底层执行入口 |
| 签名回调后聊天页继续广播与查单 | `app/(tabs)/chat.tsx` 第 1402–1499 行 | 前端与 Agent 双方都可能成为执行拥有者，状态源会分裂 | 将续跑逻辑降级为 fallback 模式，仅在兼容场景启用 |
| UI 明确提示“回到主线程继续广播与订单状态查询” | `app/(tabs)/chat.tsx` 第 1119、1347、1365 行附近 | 用户认知与产品边界错位，系统心智仍停留在 App 自己执行 | 主路径文案改为“Agent 已接管执行，主线程仅展示进度与结果” |

### P0：App 与 Agent 的上层协议并未真正建立，仍以规则匹配和执行载荷为中心

`lib/agent-wallet-intent.ts` 显示，当前所谓“Agent 意图识别”本质上仍是本地规则匹配：前端用正则识别 swap、transfer、price、portfolio、earn，再直接本地生成确认卡片。更关键的是，确认后并没有形成一个稳定的 `taskId / executionTaskId` 并提交给 Agent，而是立即在 App 内部继续往执行层推进。

这使得系统虽然在文案中多次提到“确认后调用 OKX Skill 执行”，但真正的协议却不是“面向 Agent 的任务编排协议”，而是“面向底层交易执行的技术协议”。从产品架构角度看，这是当前第二个 P0 问题。

| 现象 | 证据位置 | 风险 | 建议 |
|---|---|---|---|
| `detectAgentIntent()` 主要靠前端正则规则 | `lib/agent-wallet-intent.ts` 第 137–297 行 | App 先入为主决定执行形态，Agent 退化为名义层 | 保留规则触发仅作快捷入口，但输出必须收敛到统一 Agent 任务协议 |
| `buildConfirmCard()` 直接承诺“确认后调用 OKX Skill 执行” | `lib/agent-wallet-intent.ts` 第 299–335 行 | 语义正确，但未落到真正的 Agent task 模型 | 在确认后返回 `taskId / phase / summary`，不要直接下沉到底层执行载荷 |
| 当前字段重心仍是 `swapTransaction / signedTx / txHash / orderId` | `chat.tsx` 与 `signature-bridge.ts` | App 协议与底层发送细节过度耦合 | 将上层协议切到 `intent / taskId / phase / resultSummary / retryable` 模型 |

### P0：兼容签名桥接层仍在主路径中占据核心位置

`lib/signature-bridge.ts` 的 `PendingSignatureContext` 已经不仅仅是一个轻量回调容器，而是承载了 `swapTransaction`、`builderCodeDataSuffix`、`builderCodeCallDataMemo`、`broadcastAddress`、`orderId`、`txHash` 等核心字段。再结合 `app/sign/callback.tsx` 对 `sigSignedTx / sigTxHash / sigError` 的处理可以看出，当前系统仍把“外部签名器回跳 + 主线程恢复”当作重要执行协议的一部分。

然而仓库内部研究文档其实已经明确写出：这一层应当只保留为兼容层，而不应继续作为主路径扩张。[1]

| 现象 | 证据位置 | 风险 | 建议 |
|---|---|---|---|
| 待签名上下文长期持有完整交易执行数据 | `lib/signature-bridge.ts` 第 18–53 行 | 前端承担过多执行责任，状态恢复复杂且脆弱 | 将其明确标注为 fallback，仅用于特殊兼容场景 |
| 回调页围绕 `signedTx / txHash` 恢复主线程 | `app/sign/callback.tsx` | 产品主路径与 Agent 模型相冲突 | 将回调页文案与路由说明改成“兼容模式回调” |
| 聊天页 useEffect 直接围绕回调参数续跑 | `chat.tsx` 第 1319–1591 行 | 主线程与兼容层耦合过深 | 将续跑逻辑拆到 compatibility 模块，并从默认流程中摘除 |

### P1：服务端 `/api/onchain/*` 仍然被设计成交易执行拥有者，而非 Agent 结果承接层

`api/onchain/index.ts` 目前不仅提供 `preview / execute / receipt`，还在 `execute` 中执行风控校验、幂等判断、交易记录创建、执行结果回写、日志落盘与失败补偿。这是一套相对完整的执行生命周期拥有者设计。若你的最终边界是“Agent 自己与 Swap / Skills 交互”，那么这些能力不能继续被默认视为 App 主路径，而需要重新分类：哪些是 Agent 侧仍可复用的基础设施，哪些应降级为兼容 Provider，哪些应该被新的 Agent 任务网关替代。

| 现象 | 证据位置 | 风险 | 建议 |
|---|---|---|---|
| `POST /api/onchain/execute` 直接执行交易并更新 phase | `api/onchain/index.ts` 第 187–320 行 | 服务端定位模糊，像交易执行后端而不是 App 编排后端 | 若保留，则改名标注为 compatibility/onchain provider；主路径新增更上层的 Agent task API |
| 幂等、风控、持久化都围绕底层执行构建 | `api/onchain/index.ts`、`server/_core/onchain-tx-store.ts` | 后续团队容易继续沿错误主线扩开发 | 将这些能力上收为 Agent 执行网关的共享基础设施，而不是聊天页直连接口 |
| `receipt` 查询仍与订单/txHash 直接耦合 | `api/onchain/index.ts` 第 369 行附近 | 前端更像在消费链上查单，而不是消费 Agent 状态 | 主路径对前端暴露 `task status`，底层 order/txHash 只作结果详情 |

### P1：状态机虽然统一成 `phase`，但其语义仍偏向底层执行，而不是 Agent 任务状态

仓库已经把交易状态收敛到 `preview / awaiting_confirmation / executing / success / failed`，这是进步；但这个 `phase` 目前仍主要描述 Onchain 执行生命周期，而不是 Agent 任务生命周期。例如“已提交给 Agent”“Agent 处理中”“等待用户确认”“Agent 已恢复执行”“Agent 可重试”等更上层语义并没有独立出来，导致前端卡片虽统一了字段，却仍然很难真正摆脱旧的签名/广播心智。

建议后续把状态拆成两层：一层是 App 面向用户的 `taskPhase`，另一层是底层执行详情 `executionPhase`。前者作为聊天主线程的主状态，后者只在详情面板中展示。

### P1：文档与代码存在“认知正确、实现未完全跟上”的剪刀差

值得注意的是，仓库内部其实已经有多份文档把方向判断说得很清楚了。`docs/research/okx-agent-wallet-integration-strategy.md` 明确主张把签名桥接降级为兼容层；`docs/research/agentic-wallet-doc-notes-2026-04-17.md` 也指出官方理想体验是在对话中完成报价、确认、广播和回执，而不是跳外部确认页再回主线程。[1] [2]

这说明当前问题不在于“团队不知道要怎么做”，而在于**这些正确判断还没有真正沉淀成代码边界与模块分类**。因此，后续整改应该优先做“架构定性与目录定级”，而不是继续边开发边模糊推进。

### P2：历史交付文档仍默认把 Onchain 直连链路当成主路径，容易继续误导后续开发

`docs/governance/EXECUTION_LEDGER.md`、`docs/reports/onchain-production-gap-report-2026-04-17.md`、`docs/reports/next-phase-delivery-plan-2026-04-17.md` 等多处内容仍把“Onchain 主路径生产化”“真实发送层闭环”“Builder Code 注入发送层”等表述作为当前主任务推进方向。这些结论在你最新边界下并非全错，但需要改写为：**如果 App 自己直连执行层，这些是兼容层工程事项；若主路径交给 Agent，这些事项就不应继续被表述为 App 的核心里程碑。**

如果不修正文档，后续团队成员会继续被这些历史任务板牵着走，沿着“把 App 做成交易执行器”的方向投入资源。

## 四、整改顺序建议

在当前边界下，我建议后续整改不要直接从删代码开始，而是按下面顺序推进。

| 优先级 | 动作 | 目的 |
|---|---|---|
| P0 | 明确一份新的 App↔Agent 任务协议定义 | 先把主路径契约写清楚，避免继续沿底层执行字段扩张 |
| P0 | 在聊天页收敛“确认后提交 Agent 任务”主流程 | 让 UI 层先停止直接拥有执行生命周期 |
| P0 | 将 `signature-bridge`、`sign/callback`、`resumeSignedSwap` 标为 compatibility | 把兼容层从主路径中摘出来 |
| P1 | 为现有 `/api/onchain/*` 重命名或重新分层 | 避免团队误以为这仍是 App 主交易网关 |
| P1 | 将前端主状态改为 `taskPhase`，执行详情下沉为次级信息 | 让用户心智与产品架构一致 |
| P1 | 修订执行台账与阶段报告文案 | 阻断后续错误排期 |
| P2 | 评估哪些直连执行代码保留为 fallback，哪些应冻结不再扩张 | 降低维护成本 |

## 五、当前进度对应的阶段性判断

如果按新的职责边界来评估，我认为海豚社区 App 目前已经完成了 **“从纯前端演示链路转向 Agent Wallet 语义模型”的第一步**，但还没有完成第二步，也就是**真正把代码主路径从执行层抽离出来**。

所以当前最准确的阶段判断不是“Swap 没接完”，也不是“Onchain 生产化快完成了”，而是：

> **方向判断已经对了，但代码结构仍停留在过渡态。主路径与兼容层的边界还没有真正切开。**

这也是我现在对“进度咋样”的技术版回答：**不是卡在接口，而是卡在职责切换的最后一段重构。**

## References

[1]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/agentic-wallet "Agentic Wallet | DEX API | DEX API 文档"
[2]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/agentic-quickstart "快速开始 | DEX API | DEX API 文档"
[3]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/run-your-first-ai-agent "搭建你的第一个 AI Agent | DEX API | DEX API 文档"
[4]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/agentic-wallet-skills "Skills | DEX API | DEX API 文档"
[5]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/wallet-api-introduction "钱包 API | DEX API | DEX API 文档"
[6]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/onchain-gateway-api-overview "交易上链 | DEX API | DEX API 文档"
