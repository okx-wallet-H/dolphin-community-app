# Onchain OS 四大技能重构结论（修订版，2026-04-18）

作者：**Manus AI**  
日期：2026-04-18

## 一、修正后的核心结论

你刚才强调的原则是对的，而且我重新核对官方文档之后，结论可以明确修正为：**执行网关**与**安全风控**虽然在技术上可以单独讨论，但在海豚社区的对接口径里，**不应再被视为我们要单独建设的能力层**，而应视为 **OKX Agent Wallet / Onchain OS 已经封装好的现成 API 能力**，我们只负责对接、编排和产品化展示。[1] [2] [3]

因此，从海豚社区的产品与接入策略来看，**把整个 Onchain OS 先收敛成“钱包、交易、行情、赚币”四个技能，是成立的，而且是可落地的。**

## 二、为什么四个技能是成立的

官方资料已经给出了足够明确的依据。Agentic Wallet 官方文档写明，钱包本身就包含 **Assets & security**，其中直接包含 **multi-chain balances、risk detection、one-click revocation of malicious approvals**。[3] 这说明安全风控已经不是外部附加物，而是 Agent Wallet 自带能力的一部分。另一方面，Onchain Gateway 官方 API Reference 也明确提供了 **Get Gas Price、Get Gas Limit、Simulate Transactions、Broadcast Transactions、Get Transaction Orders** 等现成接口。[2] 这说明执行网关同样不是我们要重做的系统，而是 OKX 已封装好的执行基础设施。

所以，对海豚社区来说，最合理的理解不是六层或七层自建架构，而是：**四个产品技能之下，隐含调用 OKX 已封装的执行与安全能力。**

## 三、四个技能与 OKX 已封装能力的对应关系

| 海豚社区技能 | 对应的 OKX 现成能力 | 说明 |
|---|---|---|
| **钱包** | Agent Wallet 登录、邮箱注册、账户创建、地址管理、资产读取、恶意授权治理、风险检测 [3] [4] | 用户开通钱包、查看地址、查看余额、看资产，都归到钱包技能 |
| **交易** | DEX Swap、转账、交易模拟、Gas 估算、广播、订单追踪、交易历史 [2] [4] [5] | 交易技能本身已经内含执行网关能力，不需要海豚社区另做一套广播系统 |
| **行情** | Token 搜索、价格、K 线、热门币、聪明钱、市场监控 [4] [5] | 行情技能是用户研究与发现入口 |
| **赚币** | DeFi 产品发现、申购、赎回、收益领取、DeFi 持仓 [4] | 赚币技能就是 OKX DeFi 能力的产品化封装 |

## 四、执行网关与安全风控应该怎么归并

为了避免后续团队讨论时再出现分歧，我建议你们以后统一按下面的说法。

| 能力项 | 正确口径 |
|---|---|
| **执行网关** | 不单列为海豚社区自建模块，归入 **交易技能** 背后的 OKX 现成 API 能力 |
| **安全风控** | 不单列为海豚社区自建系统，归入 **钱包技能** 与 **交易技能** 背后的 OKX 现成 API 能力 |
| **海豚社区要做的事** | 只做 API 对接、统一意图编排、确认卡片、任务流、社区玩法封装 |

换句话说，**我们不是开发一个新的执行层和安全层，而是把 OKX 已经做好并开放的执行层与安全层，嵌入到四个技能里面。**

## 五、四个技能下，海豚社区真正要做的只是“接”和“编排”

按你的原则继续往下推，海豚社区需要做的工作可以收敛成下面这张表。

| 技能 | OKX 已有，我们直接接什么 | 海豚社区自己只补什么 |
|---|---|---|
| **钱包** | 邮箱注册/验证、钱包生成、账户查询、地址列表、资产余额、风险检测、恶意授权管理 | 钱包页 UI、聊天入口、社区身份绑定、开户引导 |
| **交易** | 报价、授权、模拟、Gas、广播、订单、历史、Swap/转账执行 | 一句话交易入口、确认卡片、交易任务编排、结果展示 |
| **行情** | Token 搜索、币价、K 线、热门榜、聪明钱、市场监控 | 社区内容分发、研究卡片、推荐逻辑、话题化展示 |
| **赚币** | DeFi 搜索、申购、赎回、奖励领取、DeFi 持仓 | 社区策略包装、收益解释、引导文案、运营活动玩法 |

## 六、这次校正后，哪些不该再被写成“我们要开发”

根据这次复核，下面这些内容以后不应再写成“海豚社区待开发底层能力”，而应该明确写成 **OKX 已封装、海豚社区待对接**：

| 不该再写成自建项 | 正确写法 |
|---|---|
| 广播交易系统 | 对接 OKX Onchain Gateway Broadcast API |
| Gas 估算系统 | 对接 OKX Get Gas Price / Get Gas Limit API |
| 交易模拟系统 | 对接 OKX Simulate Transactions API |
| 订单追踪系统 | 对接 OKX Get Transaction Orders API |
| 授权管理系统 | 对接 OKX Wallet Security Approvals API |
| 恶意授权撤销与风险识别底层 | 调用 OKX Agent Wallet / Security 能力，并在前台产品化展示 |

## 七、现在最适合你们内部采用的一句话定义

> **海豚社区的链上能力不做底层重造，而是以 OKX Agent Wallet / Onchain OS 为底座，先完整对接“钱包、交易、行情、赚币”四个技能；执行网关与安全风控全部视为 OKX 已封装能力，直接接入，不重复开发。**

## 八、接下来我建议的推进方式

既然口径已经统一，下一步最有价值的动作就不是继续抽象，而是直接把四个技能拆成 **API 对接清单**。也就是说，下一版文档应该进一步回答这四个问题：

| 下一步 | 要输出什么 |
|---|---|
| **钱包技能** | 需要对接哪些 OKX API，当前项目已接了哪些，还差哪些 |
| **交易技能** | 需要对接哪些报价、模拟、广播、回执、授权 API |
| **行情技能** | 需要对接哪些 token、price、signal、market API |
| **赚币技能** | 需要对接哪些 DeFi 搜索、申购、赎回、持仓 API |

如果你确认，我下一步就直接把这四个技能拆成一张 **“OKX API 对接清单表”**，每个技能对应具体接口、当前状态、优先级、谁都能一眼看懂。

## References

[1]: https://github.com/okx/onchainos-skills/blob/main/CLAUDE.md "onchainos-skills/CLAUDE.md at main · okx/onchainos-skills · GitHub"
[2]: https://web3.okx.com/onchainos/dev-docs/wallet/onchain-gateway-api-reference "API Reference | Broadcast Transactions | Wallet API | Onchain OS Docs"
[3]: https://web3.okx.com/onchainos/dev-docs/home/agentic-wallet-overview "Agentic Wallet | Build for AI Agent | Onchain OS Docs"
[4]: https://github.com/okx/onchainos-skills "okx/onchainos-skills - GitHub"
[5]: https://web3.okx.com/onchainos/docs/waas/walletapi-api-get-approval-detail "Get Approvals | Wallet API | WaaS Web3 API Docs"
