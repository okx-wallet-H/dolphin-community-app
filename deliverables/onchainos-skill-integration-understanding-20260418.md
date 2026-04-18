# OKX OnchainOS 文档理解与海豚社区 App Skill 对接修正说明

作者：**Manus AI**  
日期：2026-04-18

## 一、核心结论

我已经按你给的 [OnchainOS 官方文档][1]、[官方开发总览][2]、[Skills 文档][3]、[官方 Skill 仓库][4] 与 [Wallet API 文档][5] 重新对照了一遍当前项目。结论非常明确：**你说的是对的，当前正确接法应该是“围绕 OKX 已封装好的 Skill 能力来组织 Agent Wallet 的查询、交易、广播和回执链路”，而不是让聊天页自己硬编码一套半独立的 symbol 解析、正则意图识别和本地回退逻辑。** [1] [2] [3] [4] [5]

官方文档反复强调，OnchainOS 的能力已经被封装成 **Skills / MCP / Open API** 三层接入方式。其中，Skills 的定位不是单纯返回文档，而是**封装领域知识、意图路由和标准输入输出 schema**，让 Agent 可以直接承接自然语言请求，并把请求映射到正确的链上能力模块。[2] [3]

这意味着，海豚社区 App 当前“一句话交易是否支持任意金额、任意币种、任意自然语言表达”的判断标准，不能只看聊天页本地正则是否识别到 `100 USDT -> ETH` 这种样例，而要看**聊天入口是否真正把自然语言请求路由到了 OnchainOS 的统一 Skill 能力层**，并沿官方推荐的工作流完成 `token discovery -> portfolio check -> dex swap -> gateway broadcast -> receipt tracking`。如果没有做到这一点，就不能算“已经正确对接了 OnchainOS Skill”。[3] [4]

## 二、官方文档到底在表达什么

> “All capabilities are packaged as Skills and MCP Server, installable with a single command.” —— OKX OnchainOS 开发总览 [2]

> “Skills encapsulate domain knowledge and engineering workflows into stable capabilities.” —— OKX Skills 文档 [3]

> “The skills work together in typical DeFi flows: Search and Buy: okx-dex-token -> okx-wallet-portfolio -> okx-dex-swap … Swap and Broadcast: okx-dex-swap -> sign locally -> okx-onchain-gateway -> track order.” —— onchainos-skills 官方仓库 [4]

从这些官方表述可以直接抽出三个落地原则。

| 原则 | 官方含义 | 对项目的直接要求 |
|---|---|---|
| **能力要复用 Skill** | 查询、交易、广播、跟踪不是散落的自写逻辑，而是已经封装好的标准能力 | App 里不应再自己拼半套自然语言交易引擎 |
| **自然语言要走意图路由** | 用户说“买、卖、换、查、看、转”等表达时，应先被路由到正确 Skill | 聊天页不应依赖少量硬编码正则作为主判断器 |
| **交易要走完整工作流** | Token 发现、余额校验、Swap、广播、回执追踪是串联链路 | 不能只做到报价或构建交易，就宣称支持一句话交易 |

此外，Wallet API 文档也说明，官方底层能力本身就已经覆盖 **地址创建、链上资产与币价查询、交易组装、签名、广播、追踪、历史查询** 等钱包核心动作。[5] 这进一步说明，项目应当把这些能力收敛到统一的 Skill / API 能力层，而不是在前端页面里分散维护一套又一套兼容逻辑。[5]

## 三、当前项目与官方接法的主要偏差

我重新核对了当前仓库里的聊天页、Onchain 聚合层和 OKX MCP 代理层，发现问题不是“完全没接 OKX”，而是**接了一部分，但主线程没有彻底收敛到官方推荐的 Skill 工作流**。

| 模块 | 当前实现现状 | 与官方模型的偏差 |
|---|---|---|
| `app/(tabs)/chat.tsx` | 聊天页内置 `EVM_TOKEN_MAP` / `SOLANA_TOKEN_MAP`，仅覆盖 ETH、USDT、BTC、WBTC、SOL 等少数币种 | 这不是“任意币种”，而是**前端硬编码币表**；与官方 `okx-dex-token` 的动态 token discovery 思路不一致 [4] |
| `server/_core/dex-swap.ts` | `parseSwapIntent()` 优先调用 OpenAI 做本地 JSON 解析，失败后再回退到正则 | 这不是官方说的 Skill 意图路由，而是**自建 parser**；表达覆盖范围天然有限 [3] |
| `server/_core/dex-swap.ts` | `hasRealDexCredentials()` 缺凭证时切换到 `mock` provider | 当前链路可静默落到 mock，导致“表面能跑、实则非真实交易闭环” |
| `server/_core/onchain-os.ts` | 已有统一的 Onchain API 封装，支持资产、预览、执行、回执等 | 方向是对的，但聊天主线程没有完全以它为唯一能力入口 |
| `api/okx/mcp.ts` | 已定义 `swap_quote`、`swap_execute`、`swap_approve_transaction` 等本地别名 | 说明项目里**已经有官方 Skill 风格的统一能力层雏形**，但没有完全成为聊天页主路径 |
| 聊天交易主流程 | 当前是“本地解析 -> 本地 token map -> previewOnchainSwap / executeOnchainSwap” | 缺少 **token discovery**、更通用的 symbol/address 解析，以及完整 Skill 工作流编排 [4] |

换句话说，当前仓库的问题不是“完全没有 OKX Skill”，而是**已经有能力层雏形，却仍然让聊天页保留了过多旧的、本地化的、硬编码的、可回退到 mock 的主线程逻辑**。这就是为什么你会感觉：官方明明已经把各种交易、查询和链上能力都封装好了，但现在 App 里的“一句话交易”仍然不像真正的通用 Skill 集成。

## 四、对一句话交易能力的重新定义

基于官方文档，**一句话交易** 不是一个窄功能按钮，而是一条 Agent 工作流。

| 层级 | 正确能力定义 | 当前项目状态 |
|---|---|---|
| 自然语言层 | 能理解“买、卖、换、把 A 换成 B、用 A 买 B、看能买多少”等表达 | 目前仅部分覆盖，依赖本地解析器 |
| 资产识别层 | 能动态识别币种、链、地址、精度与可交易性 | 目前主要依赖硬编码 symbol map，不足 |
| 交易准备层 | 能自动走报价、授权、构建交易 | 已部分打通，但未完全统一到 Skill 工作流 |
| 执行层 | 能广播并获得可追踪回执 | 已有服务端能力基础，但端到端主线程仍不够统一 |
| 结果层 | 能把订单状态、哈希、失败原因、后续动作返回给用户 | 已有一部分，但仍夹杂 mock / best-effort 语义 |

所以，后续对 **117 一句话交易** 的验收标准必须修正为：**是否已经把聊天入口改造成“自然语言请求 -> OKX Skill/OnchainOS 工作流 -> 真实回执结果”的统一链路。** 只要聊天主线程还停留在“本地解析 + 硬编码币表 + mock 回退”，就不应该打钩。

## 五、我建议的正确对接方案

如果要按 OKX 官方文档真正对接，我建议直接按下面的结构收敛，而不是继续在聊天页追加补丁。

| 优先级 | 修正项 | 具体做法 |
|---|---|---|
| P0 | 统一一句话交易入口 | 聊天页不再主导交易意图解析，改为调用统一的 Skill Router，由服务端决定走 `okx-dex-token`、`okx-wallet-portfolio`、`okx-dex-swap`、`okx-onchain-gateway` 哪一步 [3] [4] |
| P0 | 移除硬编码币表主路径 | `EVM_TOKEN_MAP` / `SOLANA_TOKEN_MAP` 只能作为兜底展示，不能作为主解析来源；主路径要改为 token search / metadata 查询 [4] |
| P0 | 禁止静默 mock 回退 | 一旦缺少实盘凭证或真实链路失败，应明确返回“当前未连上真实 OKX Skill/OnchainOS 能力”，而不是伪造成功流程 |
| P1 | 统一 Skill 别名层 | 以 `api/okx/mcp.ts` 或服务端统一 router 作为唯一工具入口，避免聊天页、`dex-swap.ts`、`onchain-os.ts` 各自维护能力映射 |
| P1 | 补齐完整交易工作流 | 在一句话交易里显式串联 token discovery、balance check、quote、approve、execute、broadcast、receipt tracking [4] |
| P1 | 统一错误模型 | 所有失败都返回结构化错误：意图不明确、币种未识别、余额不足、链不支持、授权失败、广播失败 |
| P2 | 扩展查询型能力 | 把价格查询、资产总览、收益、转账、DeFi 搜索等，也统一收敛到 Skill 层，而不是由各页面分别拼装 |

## 六、对当前项目的最重要修正判断

当前最需要纠正的认知有两条。

第一，**117 不能再按“某个固定句式是否能买 100U ETH”来评估**。真正的评估口径应是：聊天入口是否已经成为 OnchainOS Skill 的自然语言前台。你刚才强调“100 只是比喻，应该支持任何金额、任何币”，这与官方文档是一致的。[2] [3] [4]

第二，**当前代码并不是完全没接 OKX Skill，而是接法不彻底**。项目已经有 `api/okx/mcp.ts` 这种统一别名层，也已经有 `server/_core/onchain-os.ts` 这种统一服务层，但聊天主线程仍然残留太多本地交易引擎痕迹。这说明我们下一步的重点不是再去证明“官方有没有能力”，而是要做**接入收敛**：把聊天页从“本地半自研交易入口”改造成“OnchainOS Skill 的 UI 外壳”。

## 七、我对下一步实施顺序的建议

如果你同意，我建议下一轮就按以下顺序直接改代码，而不是继续停留在口头争论上。

| 顺序 | 动作 | 目标结果 |
|---|---|---|
| 1 | 收敛聊天页交易入口 | 去掉本地硬编码解析主路径，统一委托到服务端 Skill Router |
| 2 | 接通动态 token 发现 | 让“任意币种”基于官方 token search/metadata 能力，而不是本地 map |
| 3 | 收敛报价与执行 | 统一通过 OKX Skill 风格接口完成 quote / approve / execute / receipt |
| 4 | 去掉 mock 成功假象 | 真实失败就真实报错，确保测试结果可信 |
| 5 | 重跑 117/118/119/120 | 以“真实 Skill 能力链路”重新验证并打钩 |

到这一步，Agent Wallet 才算真正朝你要的方向对齐：**不是自己发明技能，而是把 OKX 已经封装好的技能正确接进来。**

## References

[1]: https://web3.okx.com/zh-hans/onchainos "Onchain OS | 开发 Web3 钱包和 DApps | Web3 开发工具 | OKX Wallet"
[2]: https://web3.okx.com/onchainos/dev-docs/home/what-is-onchainos "What is Onchain OS | Overview | Onchain OS Docs"
[3]: https://web3.okx.com/onchainos/dev-docs/market/market-ai-tools-skills "Skills | Build with AI | Guides | Onchain OS Docs"
[4]: https://github.com/okx/onchainos-skills "okx/onchainos-skills - GitHub"
[5]: https://web3.okx.com/onchainos/docs/waas/walletapi-introduction "Introduction | Wallet API | WaaS Web3 API Docs"
