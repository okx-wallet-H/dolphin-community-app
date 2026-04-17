# OKX Onchain OS 对照检查与 Builder Code 说明

**作者：Manus AI**  
**日期：2026-04-17**

## 一、结论摘要

对照最新 **OKX Onchain OS** 官方文档后，可以明确判断：海豚社区 App 当前方向**没有走偏**，因为主路径已经开始从“通用钱包签名 + 回调续跑”收敛到 **AI 对话确认 + Onchain OS 执行承接**。但是，当前仓库仍然只是**首版接入骨架**，距离官方文档所描述的完整 Onchain OS 能力面还有几处明显空缺，尤其是 **资产入口未真正落地、行情与支付能力尚未接入、开发者平台项目生命周期未产品化、Builder Code 归因层未覆盖**。[1] [2] [3] [4]

同时，**Builder Code 不是交易执行主链路的一部分**。它更像是面向开发者增长、归因、分析与潜在激励的附加能力。对于海豚社区 App 而言，它不是当前必须先打通的 P0 功能，但如果后续你们希望统计链上转化、归因交易来源、参与生态曝光或奖励计划，那么它值得在执行链路稳定后补入。[5]

## 二、与官方文档对照后的总体判断

官方首页把 Onchain OS 定义为 **AI 时代的 Web3 基础设施**，并明确给出两种接入方式：**Skills** 与 **Open API**。同时，它将平台能力归纳为 **钱包、交易、行情、支付** 四大模块。[1] 这意味着，如果从平台全貌来看，海豚社区 App 当前已经开始接入的是其中的**钱包/交易子集**，而不是完整 Onchain OS。

| 维度 | 官方文档表述 | 当前仓库状态 | 判断 |
|---|---|---|---|
| 接入方式 | 支持 Skills 与 Open API 两种方式 [1] | 当前主骨架走服务端 Open API / facade；未接 Skills/MCP 主链路 | **部分覆盖** |
| 钱包能力 | Agentic Wallet 支持邮箱登录、TEE 托管签名、对话式驱动 [1] [2] | 已有 Agent Wallet/Onchain OS 语义收敛，但用户钱包登录与恢复尚未完整进入主交易闭环 | **部分覆盖** |
| 交易能力 | Wallet API + DEX/Onchain gateway 支持预览、模拟、广播、追踪 [2] [3] | 已实现 `preview / execute / receipt` facade，但底层仍大量复用原 dex-swap provider | **部分覆盖** |
| 行情能力 | 官方将行情作为四大核心模块之一 [1] | 仓库有市场研究/查询能力基础，但未统一并入 `/api/onchain/*` | **存在缺口** |
| 支付能力 | 官方将支付列为四大核心模块之一，基于 x402 [1] | 当前完全未接入 | **明显缺口** |
| 开发者平台 | 文档与门户强调项目、地址验证、API Key 生命周期 [3] [4] | 本地环境已写入正式密钥，但项目管理流程未产品化 | **存在缺口** |

## 三、当前已经对齐官方思路的部分

当前仓库并不是从零开始。相反，有几项关键判断已经与官方模型趋于一致。

首先，聊天页的用户心智已经从“去签名 / 发起签名”逐步收敛为“确认交易 / 确认转账 / 待确认执行”。这一点与官方关于 **Agent 在对话中驱动链上交易** 的产品模型是一致的。[1] [2]

其次，服务端已经抽出 `config / preview / execute / receipt` 这一层统一 facade。虽然底层目前仍有兼容成分，但从接口设计角度看，它已经开始逼近官方推荐的 **确认前摘要、执行、回执追踪** 语义，而不是把前端继续绑死在普通钱包的 `signedTx` 生命周期上。[2] [3]

最后，真实凭证与 API 签名也已进入可用状态。官方认证文档明确要求 `OK-ACCESS-KEY`、`OK-ACCESS-TIMESTAMP`、`OK-ACCESS-PASSPHRASE`、`OK-ACCESS-SIGN` 等标准签名头，并要求先在开发者平台创建项目，再生成 API Key。[3] 当前仓库已经完成本地凭证接入与基础接口连通性验证，这说明**底层鉴权方向是正确的**。

## 四、我认为当前最容易漏掉的点

### 1. 你们现在接的是“Onchain OS 交易骨架”，不是“完整 Onchain OS”

官方首页明确写的是四大能力：**钱包、交易、行情、支付**。[1] 而当前代码主线基本集中在 **交易执行**，外加少量钱包语义。也就是说，不能把现在这版骨架误认为“Onchain OS 已全部接完”。目前真正落地的仍主要是：

| 已初步落地的能力 | 当前状态 |
|---|---|
| 交易预览 | 已有 facade |
| 交易执行 | 已有 facade |
| 交易回执 | 已有 facade |
| 钱包语义收敛 | 已部分完成 |

而以下模块仍未真正进入统一 Onchain OS 层：

| 尚未完整落地的能力 | 当前问题 |
|---|---|
| Assets / Portfolio | 配置里宣称有 `assets`，但统一接口尚未真正实现 |
| Market Data | 还没有收敛到 `/api/onchain/*` 能力面 |
| Payment / x402 | 当前完全未开始 |
| 多模块统一状态模型 | 聊天主线程仍主要围绕 swap 执行，不是通用 Onchain task 模型 |

### 2. 用户钱包侧体验还没有完全对齐 Agentic Wallet

身份验证页明确区分了两条路：**Agentic Wallet 邮箱验证快速使用**，以及 **Open API 通过开发者平台项目 + API Key** 访问能力。[3] 这意味着一个完整产品通常会同时存在：

1. **用户侧钱包体验**；
2. **开发者侧服务端能力编排**。

而当前仓库虽然已经开始向 Agent Wallet 语义靠拢，但还没有把**用户侧钱包创建/恢复/邮箱验证**完整编入主交易闭环。因此，现在更准确的状态是：**开发者侧执行骨架已经起步，用户侧 Agent Wallet 体验还没有真正打穿。**

### 3. 网络支持边界不应只靠硬编码假设

Onchain OS 文档侧边栏有“支持的网络”栏目，但当前我直接访问该路由时返回的是站点级 404 页面，这说明公开文档路由并不稳定，或者页面路径已经变更。[6] 因此，当前代码如果只把链类型抽象成 `evm | solana`，虽然符合现阶段主观判断，但仍然过于静态。更稳妥的做法是：

- 以后优先从具体 API 返回能力或官方可用接口实时确认支持链；
- 在前端配置中引入 **capability-driven** 链支持表，而不是只靠枚举推断；
- 预留 `unsupported network` 的显式错误与回退策略。

### 4. 开发者平台项目流程还没有变成可运维能力

开发者平台当前直接展示的是：**连接钱包 → 验证地址 → 管理 API Key**。[4] 身份验证页又补充说明，Open API 需要先在开发者平台创建项目。[3] 这意味着当前仓库虽然已经在 `.env` 中落好了凭证，但还缺两类工程能力：

| 缺口 | 意义 |
|---|---|
| 项目 / 密钥来源追踪 | 防止未来环境切换时无法判断密钥属于哪个项目 |
| 地址验证与项目生命周期文档化 | 防止团队内二次部署时重复踩坑 |

这不一定马上影响本地开发，但会影响后续正式部署、交接和运维稳定性。

## 五、Builder Code 是什么

当前检索到的官方 `Builder Codes` 文档位于 **X Layer** 开发者文档，而不是 Onchain OS 交易文档主线。[5] 它的定义很清楚：

> Builder Code 是一类 **ERC-721 NFT**，每个 Builder Code 对应一个 **16 位唯一编码**，用于把链上活动归因到某个应用或钱包，并可绑定 payout address 来承接潜在奖励。[5]

从工程实现上，它通过在 calldata 末尾附加 **ERC-8021 attribution suffix** 来完成归因，不影响合约执行，也不需要修改目标智能合约。[5]

| Builder Code 维度 | 官方说明 | 对海豚社区 App 的含义 |
|---|---|---|
| 本质 | ERC-721 Builder 身份编码 [5] | 不是交易签名或执行协议 |
| 价值 | Rewards / Analytics / Visibility [5] | 更偏增长归因、数据统计、生态曝光 |
| 注入方式 | 通过 `dataSuffix` 或逐笔交易附加后缀 [5] | 需要在交易发送层处理，不在聊天 UI 层处理 |
| 与主链路关系 | 不影响合约执行 [5] | **可选增强项，不是当前 P0** |
| 当前支持限制 | EOA、ERC-7702 支持；ERC-4337 暂不支持 [5] | 若未来用 AA/4337，需要单独再核对 |

另外，官方还明确指出 **OKX Wallet 当前不会自动注入 Builder Code**，需要应用自己按集成指南配置。[5] 这意味着如果海豚社区 App 后续要接 Builder Code，就需要在**真实交易发送层**统一注入归因字段，而不是指望钱包自动完成。

## 六、对当前仓库的直接修正建议

从优先级看，我建议你把接下来的修正分成两层。

### 第一层：P0，继续补齐真正影响主链路闭环的缺口

| 优先级 | 建议动作 | 原因 |
|---|---|---|
| P0 | 补 `/api/onchain/assets` 真实实现 | 配置里已宣称支持 assets，但当前还未真正落地 |
| P0 | 把聊天主线程状态统一成 `preview / awaiting_confirmation / executing / success / failed` | 目前仍偏 swap 局部状态，不够通用 |
| P0 | 把用户侧 Agent Wallet 登录 / 钱包恢复纳入主交易闭环 | 这是 Agentic Wallet 与普通钱包最大的体验差异之一 |
| P0 | 将支持链能力改为可配置 / 可探测 | 避免后续网络覆盖判断失真 |

### 第二层：P1，作为增强项接入平台附加能力

| 优先级 | 建议动作 | 原因 |
|---|---|---|
| P1 | 收敛 market 能力到 `/api/onchain/*` | 与官方四大能力模型一致 |
| P1 | 评估 payment / x402 的产品位置 | 当前完全缺失，但官方将其列为核心能力 |
| P1 | 设计 Builder Code 注入层 | 有利于归因、分析和生态激励，但不阻塞主交易链路 |
| P1 | 补开发者平台项目/地址验证操作文档 | 降低部署与换环境风险 |

## 七、最终判断

这轮对照下来，最重要的结论有两条。

第一，**当前方向基本正确，但你们现在完成的只是 Onchain OS 的交易接入骨架，不是完整平台集成。** 这意味着后续还应继续把资产、钱包体验、链支持和平台化配置补齐，而不是过早宣布“已经全部接通”。[1] [2] [3] [4]

第二，**Builder Code 不是你们当前主链路漏掉的致命项**。它不是交易执行协议本身，而是归因/分析/激励层的增强配置。对海豚社区 App 来说，它属于“在真实交易主链路稳定后值得接”的能力，而不是必须先完成才能继续推进的阻塞项。[5]

## References

[1]: https://web3.okx.com/zh-hans/onchainos/dev-docs/home/what-is-onchainos "什么是 Onchain OS | DEX API | DEX API 文档"
[2]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/wallet-api-introduction "钱包 API | DEX API | DEX API 文档"
[3]: https://web3.okx.com/zh-hans/onchainos/dev-docs/home/api-access-and-usage "身份验证 | DEX API | DEX API 文档"
[4]: https://web3.okx.com/zh-hans/onchainos/dev-portal "Web3 开发者平台 | Web3 构建工具 | OKX Wallet"
[5]: https://web3.okx.com/zh-hans/xlayer/docs/developer/builder-codes/overview "Builder Codes | X Layer Documentation | OKX"
[6]: https://web3.okx.com/zh-hans/onchainos/dev-docs/home/supported-networks "支持的网络 | DEX API | DEX API 文档"

## 八、2026-04-17 增量实现检查：Assets 能力与 Builder Code 落点

本轮已把前文标记为 P0 缺口的 **`/api/onchain/assets`** 真正补入当前仓库。服务端 `server/_core/onchain-os.ts` 新增统一资产查询抽象，通过 OKX Onchain 余额接口 `/api/v6/dex/balance/all-token-balances-by-address` 拉取地址多链资产，并将结果标准化为 `walletAddresses -> assets` 的分组结构；本地 Express 路由 `server/_core/onchain-os-routes.ts` 与 serverless 入口 `api/onchain/index.ts` 已同步暴露 `GET /api/onchain/assets`；客户端 `lib/_core/api.ts` 也已新增 `getOnchainAssets()` 封装。当前 `pnpm check` 已通过，说明统一 Onchain assets 能力已经进入**可编译、可调用**状态。

同时，对 **Builder Code** 的代码落点进一步做了仓库内检索。当前仓库并不存在 Viem / Wagmi / `createWalletClient` / `sendTransaction` 这一类真正的 **X Layer 钱包发送层客户端**，也没有 `dataSuffix` 注入位点；现有主路径仍以服务端 Open API facade 为主。这意味着，虽然用户提供的 Builder Code `yf83qce657mgxsjw` 在格式层面符合官方 Builder Code 的 16 位编码形态，但它暂时**没有可以直接落地的发送层注入位置**。

| 检查项 | 当前判断 |
|---|---|
| Builder Code 是否已可在当前代码中直接启用 | 否 |
| 当前阻塞点 | 缺少 X Layer 客户端发送层与 `dataSuffix` 注入点 |
| 当前最佳策略 | 先保持 Builder Code 为预留配置，不写死进聊天页或纯后端 facade |
| 后续实施前提 | 当仓库接入真实的 X Layer wallet client / viem 发送层后，再在发送层统一注入 `dataSuffix` |

因此，当前仓库与官方文档的差异已经从“缺少 assets 能力”收敛为“缺少真实 X Layer 发送层，因此 Builder Code 仍处于待接入状态”。这不会阻塞海豚社区 App 的 Onchain OS 主路径继续推进，但会影响后续做 X Layer Builder attribution 与相关分析归因能力的完整度。
