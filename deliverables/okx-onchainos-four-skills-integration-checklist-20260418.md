# 海豚社区对接 OKX Onchain OS 四大技能执行清单（2026-04-18）

作者：**Manus AI**  
日期：2026-04-18

## 一、当前执行原则已经统一

当前这件事的原则已经可以完全定下来：**海豚社区不重复开发 OKX 已经完成的底层技术，而是把 OKX Agent Wallet 与 Onchain OS 已开放的 API 能力逐项对接进来，再由海豚社区完成产品编排、前端承接与社区化封装。** 这意味着后续所有任务都要围绕“接 API、通主链、做编排”展开，而不是围绕“重做钱包、重做交易引擎、重做风控系统”展开。[1] [2] [3] [4]

从官方文档口径看，这条路线是可落地的。Agentic Wallet 已经明确支持邮箱登录后的钱包能力、对话内查余额、转账与换币；DEX API 已经提供报价、授权、Swap、状态查询；Onchain Gateway 已经提供 Gas、模拟、广播与订单查询；Market API 已经提供价格、K 线、Token、地址分析、余额与历史；DeFi API 已经明确作为独立能力体系存在。[2] [3] [4] [5] [6]

## 二、四大技能的目标定义

海豚社区后续对外只需要坚持一个清晰模型：**钱包、交易、行情、赚币**。这个定义足够贴近用户认知，同时又能完整承接 OKX 已封装的能力范围。

| 技能 | 对用户的产品定义 | 对应的 OKX 底座 |
|---|---|---|
| **钱包** | 注册即开通 Agent Wallet，查看地址、余额、资产、安全状态 | Agentic Wallet、Wallet API、资产与安全能力 [2] [3] |
| **交易** | 在对话中完成报价、确认、授权、兑换、转账、回执追踪 | DEX API、Onchain Gateway、Swap 能力 [4] [5] |
| **行情** | 看价格、K 线、热点、聪明钱、地址分析、交易机会 | Market API、Token API、Strategy API、Address Analysis API [6] |
| **赚币** | 查收益产品、看 APR/TVL、发起申购、赎回、跟踪收益 | DeFi API、DeFi 搜索与后续执行能力 [7] |

## 三、当前仓库已经接到什么程度

结合现有代码，海豚社区并不是从零开始，而是已经接入了四大技能中的一部分，但成熟度不一致。

### 1. 钱包技能现状

当前仓库已经把 **邮箱验证码触发 Agent Wallet 登录/开户** 这条主链打通。`server/_core/agent-wallet.ts` 已经实现了 `auth/init`、`auth/verify`、`account/create`、`account/list`、`account/address/list` 的串联逻辑：先发验证码，再校验验证码，然后在首次登录时自动创建账户、拉取账户列表和地址列表，最后整理出 EVM 与 Solana 地址返回给前端。前端 `lib/_core/api.ts` 也已经提供了 `/api/agent-wallet/send-code` 与 `/api/agent-wallet/verify` 的标准封装，说明“邮箱注册/验证即生成钱包”这条产品前提已经具备可继续扩展的基础。

### 2. 交易技能现状

当前仓库已经形成统一的链上交易入口，而不是零散地到处直接调接口。`server/_core/onchain-os.ts` 已经把交易抽象收敛为 `previewOnchainSwap`、`executeOnchainSwap`、`getOnchainExecutionReceipt`，并把执行模型统一标记为 `agent_wallet`。`server/_core/onchain-os-routes.ts` 与 `api/onchain/index.ts` 又把这些能力暴露为 `/api/onchain/config`、`/api/onchain/assets`、`/api/onchain/preview`、`/api/onchain/execute`、`/api/onchain/receipt`。这说明海豚社区的交易技能主骨架已经有了，只是还没有把 OKX 全量交易能力全部接满。

### 3. 行情技能现状

当前仓库的行情能力主要集中在 `api/okx/mcp.ts`。这个文件已经把若干 OKX 能力做成了本地统一别名，包括 `token_price_info`、`smart_money_leaderboard_list`、`smart_money_trades`、`meme_scan_list`、`meme_scan_details` 等。这意味着币价、热点、聪明钱、Meme 扫描这部分已经有桥接层，但还没有形成一张完整的“行情技能地图”，也还没有把官方 Market API 全量接口转化为海豚社区标准能力面。

### 4. 赚币技能现状

`app/(tabs)/earn.tsx` 表明赚币页现在已经不是 mock 页面，而是直接通过 `searchDeFiProductsByMcp` 去拿真实 DeFi 产品，并把结果带入聊天主线程继续确认申购。这是一个很好的方向，因为它符合你要的原则：**先接 OKX 已有生态，再把交互包装成海豚社区自己的流程**。不过它当前仍偏重“检索与展示”，还没有完整扩展到“申购、赎回、收益追踪”的全链路。

## 四、OKX 能做而海豚社区必须全部接上的能力清单

下面这张表，是当前最关键的对接清单。它不是产品愿景，而是首轮必须逐项核销的 API 能力表。

| 技能 | OKX 已有能力 | 当前仓库现状 | 结论 |
|---|---|---|---|
| **钱包** | 邮箱登录、账户创建、账户列表、地址列表、多链余额、安全检测、恶意授权管理 [2] [3] [8] | 已接邮箱登录、账户创建、地址回收；余额能力已通过 `/api/onchain/assets` 接入；安全能力尚未显式产品化 | **已接 50% 左右，继续补资产治理与安全展示** |
| **交易** | 支持链列表、Token 列表、流动性源、授权交易、报价、Solana 指令、Swap、交易状态查询、Gas、模拟、广播、订单查询 [4] [5] | 已接 preview / execute / receipt 主链；已有幂等与风控外壳；但未把全量交易子能力显式整理成统一技能接口 | **主链已通，需扩成完整交易能力面** |
| **行情** | 实时价格、最近成交、K 线、指数价格、Token 搜索与详情、持币/榜单、策略扫描、地址分析、余额查询、历史查询 [6] | 已接币价、聪明钱、Meme、部分资产查询；未形成全量 Market API 对接清单与统一前端消费模型 | **能力分散，急需标准化收口** |
| **赚币** | DeFi 产品发现、协议搜索、多链支持，以及可继续承接申购/赎回类能力 [7] | 已接真实产品搜索与对话导流；尚未形成完整执行主链与持仓/收益看板 | **入口已成型，执行链仍需补齐** |

## 五、真正的缺口不在底层，而在“接全”和“收口”

当前最重要的判断是：**海豚社区的主要缺口不是缺底层技术，而是缺完整对接与统一封装。** 也就是说，问题已经不再是“有没有能力”，而是“当前代码里这些能力分散在不同文件与不同路由里，还没有完全收敛成四个稳定技能”。

| 缺口类型 | 当前问题 | 应对方式 |
|---|---|---|
| **能力分散** | 钱包、交易、行情、赚币分别落在不同文件和半成品路由里 | 统一收敛为四个技能清单与固定入口 |
| **接口面不完整** | 已接部分核心 API，但没有覆盖 OKX 官方全量现成能力 | 逐项补齐官方能力清单 |
| **前端消费模型不统一** | 有的走聊天，有的走独立页，有的仍是桥接态 | 统一为“技能 API + 确认卡片 + 状态回执”模型 |
| **安全能力未显式展示** | OKX 已提供风控与授权管理，但产品层还未完全体现 | 在钱包与交易页中显式呈现安全结果与授权治理 |
| **赚币停留在检索层** | 真实产品已经接入，但申购/赎回/收益跟踪仍不完整 | 继续沿 OKX DeFi API 扩成闭环 |

## 六、我建议的第一批正式对接顺序

如果现在开始真正推进，我建议不要同时散做四条线，而是按“先打主链，再补扩展”的顺序推进。优先级如下。

| 优先级 | 技能 | 先做什么 | 为什么 |
|---|---|---|---|
| **P0** | **钱包** | 稳定邮箱注册/验证、开户、地址回显、资产页、登录态保持 | 所有链上行为的前提 |
| **P0** | **交易** | 补齐报价、授权、预览、执行、广播、回执、订单状态这一整套技能接口 | 用户最直接感知价值，也最能验证 OKX 对接主链是否真的通了 |
| **P1** | **行情** | 把价格、K 线、Token 搜索、聪明钱、Meme、地址分析统一成一个标准行情层 | 这是后续推荐、研究、社区内容分发的基础 |
| **P1** | **赚币** | 在已接真实产品搜索的基础上，补申购、赎回、收益跟踪和持仓态 | 入口已有，继续补闭环即可 |

## 七、第一批落地任务应该直接落到哪些文件

为了避免后续讨论停留在抽象层，我把第一批动作直接映射到当前仓库文件。

| 文件 | 建议动作 | 对应技能 |
|---|---|---|
| `server/_core/agent-wallet.ts` | 继续作为钱包开户主链核心，不另起炉灶；补清晰的能力注释与返回结构约束 | **钱包** |
| `server/_core/onchain-os.ts` | 扩成交易技能统一服务层，明确把授权、模拟、广播、订单查询全部纳入 | **交易** |
| `server/_core/onchain-os-routes.ts` | 固定 `/api/onchain/*` 作为交易主入口，不再让旧散接口继续扩张 | **交易 / 钱包** |
| `api/okx/mcp.ts` | 把行情与赚币相关别名能力整理成标准清单，不再只停留在零散工具名 | **行情 / 赚币** |
| `lib/_core/api.ts` | 定义四大技能统一的前端类型与调用函数，成为唯一消费层 | **四技能总收口** |
| `app/(tabs)/earn.tsx` | 从“真实搜索展示”继续演进到“申购确认入口” | **赚币** |
| `app/(tabs)/chat.tsx` | 继续作为技能编排主线程，承接确认卡片与执行结果 | **钱包 / 交易 / 赚币** |
| `app/(tabs)/wallet.tsx` | 强化资产、安全、授权管理展示 | **钱包** |

## 八、现在就可以直接进入的对接任务定义

如果你要我按“开始对接”的口径继续执行，那么下一步最应该做的不是再讨论原则，而是直接输出一张**四大技能 API 对接台账**。这张台账要逐项写清楚三件事：第一，OKX 官方已经提供了什么；第二，当前仓库已经接了什么；第三，剩余还差什么。

我建议下一轮直接按下面这个格式推进。

| 下一轮输出 | 内容 |
|---|---|
| **钱包技能台账** | 登录、开户、账户、地址、余额、安全、授权管理逐项核对 |
| **交易技能台账** | token、quote、approve、swap、simulate、gas、broadcast、order/receipt 逐项核对 |
| **行情技能台账** | price、candlestick、token search、ranking、smart money、address analysis 逐项核对 |
| **赚币技能台账** | defi search、产品详情、申购、赎回、奖励、持仓、收益逐项核对 |

## 九、结论

结论已经非常清楚：**你现在的方向是对的，而且仓库也已经具备开始全面对接 OKX 的基础。** 现在最应该做的，不是重构一个新的底层体系，而是把已经存在的钱包主链、交易主链、行情桥接层、赚币搜索入口，全部按四大技能重新收口，并逐项补齐 OKX 官方已经提供但我们当前尚未完全接入的 API 能力。[1] [2] [3] [4] [5] [6] [7]

换句话说，海豚社区现在已经不是“从 0 到 1”，而是正式进入“**从 0.5 到 1**”的对接阶段。

## References

[1]: https://github.com/okx/onchainos-skills/blob/main/CLAUDE.md "onchainos-skills/CLAUDE.md at main · okx/onchainos-skills · GitHub"
[2]: https://web3.okx.com/onchainos/dev-docs/home/agentic-wallet-overview "Agentic Wallet | Build for AI Agent | Onchain OS Docs"
[3]: https://web3.okx.com/onchainos/dev-docs/wallet/agentic-quickstart "Quickstart | Agentic Wallet | Onchain OS Docs"
[4]: https://web3.okx.com/onchainos/docs/waas/dex-api-reference "API reference | Swap API | DEX API | WaaS Web3 API Docs"
[5]: https://web3.okx.com/onchainos/dev-docs/wallet/onchain-gateway-api-reference "API Reference | Broadcast Transactions | Wallet API | Onchain OS Docs"
[6]: https://web3.okx.com/onchainos/dev-docs/market/market-api-introduction "Introduction | Onchain OS Docs"
[7]: https://web3.okx.com/onchainos/docs/waas/defi-api-reference-introduction "Introduction | API reference | DeFi API | WaaS Web3 API Docs"
[8]: https://web3.okx.com/onchainos/docs/waas/walletapi-api-get-approval-detail "Get Approvals | Wallet API | WaaS Web3 API Docs"
