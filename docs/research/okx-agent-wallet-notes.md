# OKX Agent Wallet 调研笔记

## 当前已确认的官方信息

### 1. 产品定位
OKX 官方文档将 **Agentic Wallet** 定义为“专为 AI Agent 设计的链上钱包”，其目标不是仅提供地址与签名能力，而是让 Agent 直接成为链上执行者，支持持有资产、签名、发起交易等完整能力。

### 2. 与普通钱包的重要差异
当前文档明确强调以下特征：

| 维度 | 官方表述要点 |
|---|---|
| 创建方式 | 邮箱登录即可直接创建钱包，无需助记词，无需自行配置密钥服务 |
| 私钥模型 | 私钥在 TEE 安全环境中生成与存储，Agent 可以交易，但无法接触私钥 |
| 执行模型 | 文档直接写明 Agent 安装钱包后可在对话中完成代币兑换、余额查询、转账等操作 |
| 安全机制 | 交易执行前会做风险模拟评级，并包含黑地址拦截、风险代币预警等机制 |

### 3. 对当前仓库方案的初步影响
这说明海豚社区 App 目前采用的“通用钱包 + 外部签名跳转 + 回调续跑 + 手动广播”的假设，**很可能比 OKX Agent Wallet 原生模型更重**。如果 Agentic Wallet 官方接入已把签名、执行、风控、广播封装为原生能力，那么聊天主线程更合理的接入方式应该更接近：

1. 让 Agent 发起 OKX 官方钱包能力调用；
2. 由 Agentic Wallet 在受控环境中完成签名与交易执行；
3. App 主要承接意图、展示状态、读取回执，而不是自己组织 signedTx 广播闭环。

### 4. 当前仍待继续核实的问题

| 问题 | 说明 |
|---|---|
| 集成入口 | 是通过 Skills / MCP / CLI 还是独立 Wallet API 接入 |
| 兑换能力 | 是钱包原生就支持 swap，还是仍需配合 DEX API / Skills |
| App 接入方式 | 移动端 App 是否可直接调官方接口，还是更适合走服务端代理 |
| 交互模型 | 用户是否仍需手动确认，还是 Agent Wallet 支持更强的托管式执行策略 |

## 当前参考页面

1. https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/agentic-wallet
2. https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/agentic-quickstart

## 追加发现：快速开始与 Skills 页面

### 5. 官方示例确认了“对话式交易”是原生产品路径
在“搭建你的第一个 AI Agent”页面中，官方直接给出了一条完整交易示例链路：

1. 用户用自然语言让 Agent 筛选代币并买入；
2. Agent 返回推荐结果并给出交易报价；
3. 用户在对话里确认；
4. Agent 随后直接广播交易，并返回订单号、钱包地址与链上广播结果。

这说明官方产品心智并不是“App 自己拼签名跳转页面，再回调继续广播”，而是更接近**Agent 在钱包能力层内部完成报价、确认、执行与回执**。

### 6. 快速开始页面明确写出可直接完成兑换、余额查询、转账
快速开始页面原文指出：安装 Agentic Wallet 后，Agent 可以在对话中直接完成“代币兑换、余额查询、转账”等操作，无需切换工具、无需手动签名。这进一步支持用户刚才的判断：**兑换很可能就是 Agent Wallet 的内含能力，而不是我们前端额外拼装的一条复杂外部签名链路。**

### 7. Skills 页面说明官方鼓励用自然语言选择能力，而非手动指定底层流程
Skills 页面写明：OKX Agentic Wallet 提供从登录认证到链上交易执行的完整流程，用户只需用自然语言告诉 Agent 要做什么，Agent 会自动选择对应功能执行。

当前页面目录中已经能看到以下能力范围：

| 模块 | 目录可见能力 |
|---|---|
| 钱包基础 | 钱包登录认证、钱包管理、资产组合查询 |
| 安全能力 | 安全检测 |
| 执行能力 | 转账发送、交易历史 |
| 组合能力 | 跨功能组合工作流 |

这表明 Agentic Wallet 的设计思路更偏向“能力编排层”，而不只是传统钱包 SDK 的地址/签名接口。

### 8. 当前判断进一步收敛
对于海豚社区 App，后续需要重点核实的是：

| 方向 | 当前判断 |
|---|---|
| 兑换实现 | 大概率应走 Agentic Wallet / OnchainOS 官方能力，而不是 App 端自建签名广播闭环 |
| App 角色 | 更适合作为对话式意图承接与状态展示层 |
| 应删减的复杂度 | 目前仓库里新增的通用钱包式 pending signature / callback / signedTx 广播模型，可能只适合兜底或兼容层，而不应成为主路径 |
| 下一步最关键问题 | 要继续确认官方到底提供 Skills API、Wallet API、MCP、CLI 中的哪一种最适合 App 集成 |

## 追加参考页面

3. https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/run-your-first-ai-agent
4. https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/agentic-wallet-skills

## 追加发现：钱包 API 与交易上链

### 9. 官方确实提供 Wallet API，而不只是前端钱包容器
“钱包 API”介绍页明确说明：Wallet API 是 OnchainOS 的核心基础设施模块，面向 DApp 开发者提供完整的链上资产查询与交易执行能力，一套接口覆盖多链场景。页面中明确列出了三类能力：

| 能力 | 页面描述 |
|---|---|
| 查询余额 | 实时查询资产总值、多链代币余额与指定代币持仓 |
| 交易上链 | 估算 Gas、模拟执行、广播交易、追踪订单状态 |
| 查询交易历史 | 按地址或条件查询完整交易记录 |

这说明官方思路并不是把开发者限制在“只拿签名结果”的层面，而是提供更完整的钱包基础设施接口。

### 10. 交易上链能力支持模拟与广播，并可与 Swap API 配合
“交易上链”页面原文指出：该能力支持链上交易模拟与广播，整合 OKX Web3 自研 RPC 节点与第三方节点实现智能广播，并且**可与 Swap 及跨链 API 配合使用，构建完整体验，无需外部资源。**

这句话非常关键。它意味着：

1. 如果采用 OKX 原生体系，兑换未必需要 App 自己组织 signedTx 广播；
2. 钱包能力层本身就覆盖“模拟 + 广播”；
3. 与 Swap API 配合时，App 更像编排者和状态展示层，而不是自己维护一条外部签名回调链路。

### 11. 当前技术判断
海豚社区 App 现有的 pending signature / callback / resume / broadcast 方案，更像是基于“普通非托管钱包”假设设计的兼容实现；但从官方文档看，OKX Agentic Wallet 更可能适合采用 **OnchainOS Wallet API + Swap/DeFi API + 对话确认** 的一体化模型。

## 追加参考页面

5. https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/wallet-api-introduction
6. https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/onchain-gateway-api-overview

## 追加发现：认证方式与服务端封装边界

### 12. Agentic Wallet 有两套认证模型，适合不同落地阶段
官方“身份验证”页面明确区分了 **Agentic Wallet** 和 **Open API / Skills** 两种接入路径。[7]

| 路径 | 认证方式 | 适用场景 | 对海豚社区 App 的意义 |
|---|---|---|---|
| Agentic Wallet | 邮箱验证码登录，或 API Key | 快速上手的钱包创建与使用；也可扩展到开发者模式 | 客户端用户钱包体验可以优先走邮箱登录模型，更贴合 Agent Wallet 心智 |
| Open API / Skills | 开发者平台项目 + API Key / Secret / Passphrase | 需要完整 API 能力与服务端封装 | 服务端统一编排 Wallet / Swap / 查询能力时应走这一路径 |

### 13. 邮箱登录模式说明了用户侧不一定需要暴露开发者密钥
官方文档写明：

> “用邮箱即可创建/使用钱包，无需注册开发者账号或配置密钥，适合快速上手体验。”[7]

这意味着海豚社区 App 在产品层可以把**用户钱包侧体验**设计成更轻的邮箱登录或恢复模式，而不是要求用户自己管理 API Key。

### 14. 服务端 Open API 认证仍然需要标准签名头
同一页面同时明确了 Open API 的认证要求：所有 API 请求都需要携带 `OK-ACCESS-KEY`、`OK-ACCESS-TIMESTAMP`、`OK-ACCESS-PASSPHRASE`、`OK-ACCESS-SIGN` 四类头；签名算法为 `timestamp + method + requestPath + body` 的 HMAC SHA256 再 Base64 编码，且时间戳与服务端时差不得超过 30 秒。[7]

这与当前仓库里 `api/okx/onchain/index.ts`、`api/okx/mcp.ts` 中的签名思路一致，说明**首版 Onchain OS 服务抽象可以直接复用现有服务端签名模式**，不需要重造认证底座。

### 15. 当前可执行结论
海豚社区 App 的首版落地更适合采用“双层模型”：

1. **客户端用户侧**：围绕 Agent Wallet 的邮箱登录 / 钱包恢复体验组织产品流程；
2. **服务端开发侧**：围绕 Onchain OS Open API / Skills 做统一签名封装和能力代理。

这也意味着当前代码中最值得优先推进的不是继续扩展签名回调 UI，而是把服务端接口命名、类型定义与聊天主线程状态，真正收敛到 `confirmation + execution + receipt` 的 Agent Wallet 模型上。

## 追加参考页面

7. https://web3.okx.com/zh-hans/onchainos/dev-docs/home/api-access-and-usage

## 追加发现：Skills 能力组合与首版可封装接口

### 16. 官方 skills 仓库给出了更接近工程落地的能力拆分
`okx/onchainos-skills` 仓库首页直接将 Onchain OS 能力描述为 **Wallet、token discovery、market data、DEX swap、transaction broadcasting**，并要求通过 `.env` 提供 `OKX_API_KEY`、`OKX_SECRET_KEY`、`OKX_PASSPHRASE` 才能启用完整技能。[8]

这说明海豚社区 App 的服务端集成不应只做“兑换”单点，而应该先抽象出一层统一的 **Onchain OS service facade**，覆盖至少以下能力：

| 能力组 | 官方工作流中的位置 | 对海豚社区 App 的直接价值 |
|---|---|---|
| Wallet portfolio | holdings / balance | 钱包页资产、聊天页余额检查、执行前余额校验 |
| DEX swap | get tx data | 兑换预览、生成执行请求、给主线程展示结构化确认卡片 |
| Onchain gateway | simulate / broadcast / track | 执行前模拟、广播交易、订单与回执跟踪 |
| Market / token / signal | research / smart money | 社区研究、热门币追踪、智能推荐卡片 |

### 17. 官方 workflow 与当前仓库现状对照
官方推荐的完整交易流是：

> `token → market → wallet → dex-swap → onchain-gateway(simulate + broadcast + track)`[8]

当前仓库已经具备：

1. **market / token / MCP 查询类能力**；
2. **wallet 资产读取能力**；
3. **dex quote / execute / orders** 的首版服务端接口；
4. **聊天页结构化卡片** 与执行回执承接。

因此首版重构不需要推翻现有模块，而是应把 `dex` 相关接口语义从“通用签名器模型”重命名并收敛为更符合 Agent Wallet 的三段式：

- `preview`：拿报价、风险与确认摘要；
- `execute`：触发 Agent Wallet / Onchain OS 执行；
- `receipt`：追踪订单与链上结果。

### 18. 工程层面的直接结论
现阶段最值得优先落地的不是把所有 skills 全接完，而是优先建设：

1. `server/_core/onchain-os.ts` 一类的统一服务抽象；
2. `preview / execute / receipt / assets` 四个稳定接口形态；
3. 聊天主线程中统一的 `confirmation / executing / settled / failed` 状态模型。

这样后续无论底层是走 Agent Wallet 邮箱模式、API Key 模式，还是继续保留兼容层，都能保持前端对话语义稳定。

## 追加参考页面

8. https://github.com/okx/onchainos-skills

## 2026-04-17 补充调研：开发者平台与 Builder Code

### 19. 开发者平台目前强调的是钱包地址验证与 API Key 管理
`Web3 开发者平台` 页面当前最直接暴露的流程是：

1. **连接钱包**；
2. **验证地址**；
3. 再进入 API Key 管理等开发者操作。

这说明 Onchain OS 的开发者入口首先是**基于钱包地址的项目管理与开发者身份验证**，而不只是单纯填一组 API Key。

### 20. Builder Code 的官方定义与它和 Onchain OS 的关系
目前检索到的官方 `Builder Codes` 页面位于 **X Layer 开发者文档**，其定义非常清楚：

- Builder Code 是一个带有 **16 位唯一编码** 的 **ERC-721 NFT**；
- 它用于把链上活动**归因**到某个应用或钱包；
- 元数据中绑定了一个 **payout address**，用于接收潜在奖励；
- 主要价值包括 **Rewards、Analytics、Visibility**，也就是返佣/激励、开发者平台统计分析、以及在生态发现位中的展示。

### 21. 工程上 Builder Code 不是交易执行主链路，而是归因层能力
官方说明 Builder Code 的接入方式，是在交易 calldata 尾部追加 **ERC-8021 attribution suffix**；该后缀不会影响合约执行，也不要求改智能合约本身。页面还明确提到：

- 常见做法是在客户端发送交易时配置 `dataSuffix`；
- 支持 EOA 与 ERC-7702 smart wallet；
- **ERC-4337 user operation 目前还不支持**；
- `OKX Wallet` 目前还**不会自动注入 Builder Code**，应用侧需要自己按集成文档加上。

因此，对海豚社区 App 而言，Builder Code 更像是**后续可选的增长归因与分析能力**，而不是当前 Onchain OS `preview / execute / receipt` 主链路缺失就无法工作的核心执行依赖。

## 2026-04-17 补充调研：支持网络与身份验证页复核

### 22. `supported-networks` 路径当前返回 404 风格页面
我尝试直接访问 `https://web3.okx.com/zh-hans/onchainos/dev-docs/home/supported-networks`，当前返回的是站点级 404 页面，而不是有效的文档正文。这说明：

1. 当前文档路由可能已经调整；
2. 侧边栏虽然展示“支持的网络”，但公开链接不一定稳定；
3. 我们不能仅凭这个静态路由假定官方网络列表仍与旧版一致，后续应在具体 API 页面或实际调用返回中确认链支持范围。

### 23. 身份验证页再次确认了双路径认证模型
身份验证页继续印证此前判断：

- **Agentic Wallet** 可通过邮箱验证快速使用；
- **Open API** 则要求先在开发者平台创建项目并生成 API Key；
- 所有 Open API 请求都必须携带 `OK-ACCESS-KEY`、`OK-ACCESS-TIMESTAMP`、`OK-ACCESS-PASSPHRASE`、`OK-ACCESS-SIGN`；
- 签名算法仍是 `timestamp + method + requestPath + body` 后做 **HMAC SHA256 + Base64**；
- 时间戳与服务端时差不得超过 **30 秒**。

### 24. 与当前仓库对比时需要特别注意的新增点
身份验证页正文里明确写到“**先在开发者管理平台创建项目**并生成 API key”，这意味着我们当前虽然已经完成 API Key 鉴权与 `PROJECT_ID` 兼容写入，但仍要继续核实：

- 当前代码是否在所有相关 Open API 调用里都正确使用了项目级字段；
- 开发者平台中的项目、地址验证与 API Key 生命周期管理，是否还有额外的正式接入前置步骤；
- 后续如果接入更多 Onchain OS 模块（如支付、行情），是否还需要新的项目级配置，而不只是复用一组交易接口密钥。
