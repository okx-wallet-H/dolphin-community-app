# Agent Wallet 与 Onchain OS Skills 能力归类整理（2026-04-18）

作者：**Manus AI**  
日期：2026-04-18

## 一、先给你结论

我把当前海豚社区 App 里的 **Agent Wallet** 能力，按照 OKX **Onchain OS Skills** 的官方能力域重新整理后，可以归成七个主层：**钱包账户层、资产组合层、市场与发现层、交易执行层、链上网关层、安全风控层、DeFi 收益层**。其中，当前你们项目里已经比较明确落地的是 **钱包账户、资产查询、Swap 预览与执行承接、回执追踪、部分市场查询与部分 DeFi 搜索**；而真正还没有完全收口的，主要是 **转账统一广播、安全能力显式化、DeFi 申购闭环、自动任务联动**。

从官方定义看，Onchain OS 的 Skills 并不是“返回几条文档说明”，而是把 **意图路由、能力选择、执行顺序、错误处理** 一起封装成稳定能力。[1] 官方仓库也已经把这些能力明确拆成 `okx-agentic-wallet`、`okx-wallet-portfolio`、`okx-dex-token`、`okx-dex-market`、`okx-dex-swap`、`okx-onchain-gateway`、`okx-defi-invest`、`okx-defi-portfolio`、`okx-security` 等模块。[2] 所以，你现在要的“归类”，本质上就是把海豚社区 App 现有 Agent Wallet 能力，对齐到这套标准能力域上。

## 二、Onchain OS Skills 的标准能力分层

先按官方资料，把 Onchain OS 相关 Skills 做一版适合你项目理解的归类。

| 一级能力层 | 对应官方 Skill | 官方定位 | 在你项目里的理解 |
|---|---|---|---|
| **钱包账户层** | `okx-agentic-wallet` | 钱包生命周期、认证、余额、发送、交易历史、合约调用 [2] [4] | Agent Wallet 的登录、地址下发、会话保持、钱包执行承接 |
| **资产组合层** | `okx-wallet-portfolio`、`okx-defi-portfolio` | 公链地址资产、持仓、组合估值、DeFi 头寸 [2] | 钱包资产页、总资产、多链余额、DeFi 持仓总览 |
| **市场与发现层** | `okx-dex-token`、`okx-dex-market`、`okx-dex-signal`、`okx-dex-trenches` | Token 搜索、价格、K线、聪明钱、热点币、持仓分析 [1] [2] | 聊天中查币价、看热门、看聪明钱、找可交易 Token |
| **交易执行层** | `okx-dex-swap` | DEX 聚合换币、获取交易数据、执行交易 [2] | 一句话交易、Swap 预览、确认卡片、执行请求构建 |
| **链上网关层** | `okx-onchain-gateway` | Gas 估算、模拟、广播、订单追踪 [2] | 确认后广播、执行状态、order 查询、txHash 回执 |
| **安全风控层** | `okx-security` | 风险扫描、钓鱼检测、预执行检查、签名安全、授权管理 [2] | 风险校验、可疑授权拦截、执行前安全提示 |
| **DeFi 收益层** | `okx-defi-invest` | DeFi 产品发现、申购、赎回、领取奖励 [2] | 赚币推荐、策略申购、收益查看、理财动作闭环 |

这套分层和官方对 **Agentic Wallet** 的解释也是一致的。官方强调，Agentic Wallet 在 Onchain OS 中补的是 **execution layer**，也就是让 Agent 能真正持有、转移、管理链上资产，并且每笔交易会先模拟，再进行风险分级与确认。[3] 官方文档则进一步把 Agentic Wallet 的能力概括成 **Automated trading、Assets & security、Multi-wallet、Auto-payments、Market monitoring**。[4]

## 三、把海豚社区 App 当前 Agent Wallet 能力重新归类

如果把你们仓库当前已经实现或部分实现的能力，按上面那套 Skills 体系去归类，可以整理成下面这张表。

| 你们当前 Agent Wallet 能力 | 应归入的 Onchain OS Skill 域 | 当前状态判断 | 说明 |
|---|---|---|---|
| 邮箱验证码登录 | **`okx-agentic-wallet`** | 已落地 | 属于钱包生命周期与身份建立 |
| EVM / Solana 地址下发 | **`okx-agentic-wallet`** | 已落地 | 属于 wallet account context |
| 会话恢复、当前用户查询、登出 | **`okx-agentic-wallet`** | 已落地 | 属于钱包会话与生命周期管理 |
| 多链资产总览 | **`okx-wallet-portfolio`** | 已落地 | 属于地址资产与组合价值查询 |
| 聊天中“我的资产 / 持仓 / 钱包余额” | **`okx-wallet-portfolio`** | 已落地 | 已被统一意图协议收敛为 `portfolio_query` |
| 价格查询、行情查询 | **`okx-dex-market`** | 已落地 | 已被统一意图协议收敛为 `price_query` |
| Token 搜索与币种发现 | **`okx-dex-token`** | 部分落地 | 当前仍有前端静态 token map 痕迹，未完全动态化 |
| 聪明钱榜单、聪明钱交易 | **`okx-dex-signal`** | 已接入能力层 | 聊天页已能触发对应查询能力 |
| 热门 Meme 扫描 | **`okx-dex-trenches`** / `okx-dex-token` | 已接入能力层 | 当前有热门币扫描与详情查询入口 |
| 一句话 Swap 意图识别 | **`okx-dex-swap`** 前置路由 | 已开始统一 | 已归到固定规则 / 模板触发意图 |
| Swap 确认卡片 | **`okx-dex-swap`** + `okx-onchain-gateway` 之间的 UI 承接 | 已落地 | 符合“先确认再执行”的产品方向 |
| Swap 报价预览 | **`okx-dex-swap`** | 已落地 | 属于交易准备层 |
| Swap 执行请求构建 | **`okx-dex-swap`** | 已落地 | 已可形成待签名执行请求 |
| 广播与订单回执 | **`okx-onchain-gateway`** | 已有基础，但未完全收口 | 服务端已有 execute / receipt 模型 |
| 转账意图识别 | **`okx-agentic-wallet`** 的 send 能力 | 部分落地 | 当前更多在确认承接层，真实广播未完全补齐 |
| 转账确认卡片 | **`okx-agentic-wallet`** | 部分落地 | 前半段完成，后半段链上执行未完全统一 |
| 执行风控校验 | **`okx-security`** | 部分落地 | 已有 risk validation，但还不是完整安全 Skill 形态 |
| 赚币产品搜索 | **`okx-defi-invest`** | 已接入查询能力 | 已支持 DeFi 产品搜索与方案返回 |
| DeFi 真实申购 / 赎回 / 领奖励 | **`okx-defi-invest`** | 未完整落地 | 目前推荐比闭环强，执行动作还弱 |
| DeFi 持仓总览 | **`okx-defi-portfolio`** | 可能部分具备，但未形成显式主路径 | 当前主要展示基础资产，不是完整 DeFi 头寸中枢 |
| 自动支付 / x402 | **`okx-x402-payment`** | 当前未纳入主链路 | 暂时不是 Agent Wallet 当前主卖点 |

## 四、按照“你现在已有多少”来重新分组

如果不按官方 Skill 名称，而按你现在项目阶段更容易看的方式来分，我建议你直接记成 **四层成熟度**。

| 分组 | 包含能力 | 当前成熟度 |
|---|---|---|
| **已成型主链路** | 登录、地址下发、资产查询、价格查询、Swap 预览、Swap 执行承接、回执查询 | 高 |
| **已接入但还没完全闭环** | 转账、DeFi 赚币启动、自动任务联动、动态 Token 发现 | 中 |
| **已有底层能力但前台没完全统一** | onchain gateway、risk validation、order tracking、幂等控制 | 中 |
| **官方体系中存在，但你们当前还没作为主卖点接入** | 完整 security skill、defi portfolio、x402 payment、多子钱包并行策略 | 低 |

这张表的意义在于，你后面做汇报时不需要把所有 Skill 都说成“我们都做了”，而是可以很清楚地区分：**哪些已经在 App 里形成用户可感知能力，哪些只是底层接了，哪些还只是官方框架中存在但你们尚未产品化。**

## 五、和当前仓库代码一一对应后的最清晰归类

结合当前仓库实现，我再给你一版更贴代码落点的映射。

| 仓库侧模块 | 主要职责 | 对应 Onchain OS Skills 归类 |
|---|---|---|
| `lib/agent-wallet-intent.ts` | 统一识别 `swap / transfer / price_query / portfolio_query / earn_query` | 属于 **Skill Router / Intent Router 前台层**，把自然语言请求分发到不同 Skills |
| `app/(tabs)/chat.tsx` | 聊天页承接意图、展示确认卡片、触发资产/价格/Swap/赚币分支 | 属于 **Agent UI 编排层**，不是 Skill 本体，但负责调用 Skill 能力 |
| `api/onchain/index.ts` | 提供 `assets / preview / execute / receipt` 路由 | 主要对应 **`okx-wallet-portfolio` + `okx-dex-swap` + `okx-onchain-gateway`** |
| `server/_core/dex-swap.ts` | 报价、构建交易、广播、订单查询 | 主要对应 **`okx-dex-swap` + `okx-onchain-gateway`** |
| `api/okx/mcp.ts` | 本地 alias：`token_price_info`、`portfolio_all_balances`、`defi_search`、`swap_quote`、`swap_execute` 等 | 属于 **本地 Skill 别名层**，已经很接近官方 Skills 结构 |
| `server/_core/okx-mcp-service.ts` | 服务端 OKX MCP 桥接 | 属于 **服务端 Skill 能力桥** |

这里有一个很重要的判断：**你们项目现在其实已经不是“没有 Skill 结构”，而是“Skill 结构已经有了，但前台主线程与底层能力层还没有完全彻底收口”。** 这就是为什么当前最该做的，不是重新发明能力，而是继续把 Agent Wallet 的前端入口、确认卡片、执行网关、回执跟踪全部对齐到这套 Skills 分类上。

## 六、我建议你后面汇报时直接采用的归类口径

如果你是要发给老板、产品或研发团队，我建议直接用下面这套口径，最清楚。

| 对外口径 | 内部真实含义 |
|---|---|
| **钱包层能力** | 登录、地址、会话、账户上下文，对应 `okx-agentic-wallet` |
| **资产层能力** | 多链资产、持仓、余额、估值，对应 `okx-wallet-portfolio` |
| **行情与发现层能力** | 价格、Token 搜索、热门币、聪明钱，对应 `okx-dex-market`、`okx-dex-token`、`okx-dex-signal` |
| **交易层能力** | Swap 报价、确认、执行，对应 `okx-dex-swap` |
| **链上执行层能力** | 模拟、广播、订单、回执，对应 `okx-onchain-gateway` |
| **收益层能力** | 赚币产品搜索、策略申购、收益动作，对应 `okx-defi-invest` |
| **安全层能力** | 风险校验、恶意授权识别、预执行安全，对应 `okx-security` |

这套口径最大的好处，是你后面做架构重构时，就不会再把“聊天页自己识别一句话交易”误当成一个孤立功能，而会把它理解成：

> **聊天页只是 Agent 的前台入口，真正的能力归属应该落在 Onchain OS Skills 的标准域里。**

## 七、当前最需要补齐的 Skills 空白

最后我把“还差什么”也按 Skills 分类给你单独拉出来，这样最利于排优先级。

| 技能域 | 当前缺口 | 优先级 |
|---|---|---|
| **`okx-agentic-wallet`** | 转账真实广播与完整回执还未彻底闭环 | P0 |
| **`okx-dex-token`** | 动态 Token 发现还没有完全替代前端静态 token map | P0 |
| **`okx-onchain-gateway`** | 执行后广播与回执体验虽有底层能力，但前台主线程仍需收口 | P0 |
| **`okx-defi-invest`** | 赚币推荐已具备，但真实申购/赎回/自动联动还未闭环 | P1 |
| **`okx-security`** | 已有风险校验，但还没有作为完整独立安全能力显式呈现 | P1 |
| **`okx-defi-portfolio`** | DeFi 头寸总览尚未成为主展示层 | P2 |
| **`okx-x402-payment`** | 当前未进入主业务闭环 | P2 |

## 八、最终一句话总结

如果只用一句话概括这次归类结果，那就是：

> **海豚社区 App 当前的 Agent Wallet，已经基本覆盖了 Onchain OS Skills 里的“钱包、资产、市场查询、Swap 执行、链上回执、部分 DeFi 搜索”六大主能力方向；但还需要继续把“转账广播、动态 Token 发现、DeFi 执行动作、安全能力显式化”补齐，才能真正成为一套完整的 Skill 化 Agent Wallet。**

## References

[1]: https://web3.okx.com/onchainos/dev-docs/market/market-ai-tools-skills "Skills | Build with AI | Guides | Onchain OS Docs"
[2]: https://github.com/okx/onchainos-skills "okx/onchainos-skills - GitHub"
[3]: https://www.okx.com/en-us/learn/agentic-wallet "Introducing OKX Agentic Wallet"
[4]: https://web3.okx.com/onchainos/dev-docs/home/agentic-wallet-overview "Agentic Wallet | Build for AI Agent | Onchain OS Docs"
