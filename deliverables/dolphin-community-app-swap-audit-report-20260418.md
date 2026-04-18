# 海豚社区 App：OKX Swap / Onchain 执行链代码审查与修正报告

**作者：Manus AI**  
**日期：2026-04-18**

## 一、结论摘要

本轮审查聚焦在海豚社区 App 当前仓库中与 **OKX Onchain OS / DEX Swap** 相关的主执行链。结论很明确：仓库此前虽然已经具备了统一 Onchain 入口、聊天主线程承接、回执轮询骨架与前端卡片状态机，但在真正进入 **OKX 官方已封装的 Swap 能力** 时，仍然存在几处关键断点，导致代码会在看似“已接好”的情况下继续回落到 mock 路径，无法稳定形成真实的“报价 → 待确认执行 → 广播 → 回执查询”闭环。[1] [2] [3]

本轮已经完成的实质性修正包括：其一，修正 `server/_core/dex-swap.ts` 中真实凭证判断与签名头构造的环境变量兼容逻辑，使其不再因为别名不一致而错误进入 mock；其二，把广播后的主回执查询优先切到 **`/api/v6/dex/aggregator/history` + `chainIndex + txHash`** 这条与新版 Onchain OS 文档一致的链路，仅在必要时才回退到旧的 `post-transaction/orders`；其三，统一 `success / failure / pending` 与旧版 `txStatus` 数字状态之间的映射，让服务端 phase、前端消息卡片和回执轮询逻辑说的是同一套状态语言；其四，修正聊天主链中的 `swap` 意图 `mockMode` 不再被硬编码为 `true`；其五，将 `dex-swap` 的意图解析切换到统一 LLM 层，使其与当前已接入的 GLM 5.1 主入口保持一致。

不过，**真实端到端联调目前仍未完成最后一步**。原因不是代码仍然在错误回退，而是当前本地仓库 `.env` 实际只包含 GLM 相关配置，并未注入任何 `OKX_DEX_*`、`OKX_API_*` 或 `OKX_ONCHAIN_*` 私有凭证。因此，本轮能够确认“代码主链已经收敛正确”，但还不能在本地直接证明“真实 OKX 执行已经成功跑通”。这属于环境层阻塞，而不再是当前代码主链设计的首要问题。

## 二、审查范围与本轮触达文件

本轮先依据 OKX Onchain OS / DEX 文档确认新版能力边界，再回到仓库比对真实实现，重点检查了意图识别、报价预览、待确认执行、广播、回执查询、前端状态承接与 serverless 网关透传几个环节。[1] [2] [3] [4]

| 模块 | 主要文件 | 本轮结论 |
|---|---|---|
| DEX 核心执行链 | `server/_core/dex-swap.ts` | 已修正真实凭证判断、history 主回执链、状态归一化与统一 LLM 意图解析 |
| Onchain 统一封装 | `server/_core/onchain-os.ts` | 已补齐 `failed` phase 与 `txHash` 驱动的回执轮询条件 |
| 聊天主链 | `server/_core/chat-ai.ts`、`app/(tabs)/chat.tsx` | 已修正 swap `mockMode` 判定与前端回执轮询逻辑 |
| API 网关 | `api/onchain/index.ts`、`api/dex/index.ts`、`lib/_core/api.ts` | 已补齐 `txHash` 参数透传、失败状态兼容与调试快照的真实凭证判断 |
| 验证与证据 | `scripts/test_agent_wallet_swap_flow.ts`、`.manus_notes/*.md` | 已完成类型检查与脚本级 smoke test，定位剩余阻塞为本地 OKX 私有环境变量缺失 |

## 三、发现的核心不足

### 1. 真实凭证判断存在别名断层，导致执行链误判为 mock

代码原先主要依赖 `OKX_DEX_API_KEY / OKX_DEX_SECRET_KEY / OKX_DEX_PASSPHRASE` 一组命名，但仓库其他模块、示例环境文件以及前序接入过程又同时出现 `OKX_API_KEY / OKX_API_SECRET / OKX_API_PASSPHRASE`、`OKX_ONCHAIN_*` 等别名。结果就是：即便外部已经按另一套命名注入了真实凭证，`dex-swap` 仍然可能判断 `hasRealDexCredentials()` 为假，从而直接回退到 mock。这类问题表面上是环境变量命名问题，实质上会把整条真实执行链伪装成“能力正常但暂时无结果”，属于生产级高风险缺陷。

### 2. 广播后仍过度依赖旧订单查询路径，未优先对齐新版 v6 history

根据新版 OKX Onchain OS / DEX 文档，Swap 报价与交易能力已收敛在新版 DEX API 体系下，链上交易结果查询应优先围绕 **history / transaction history** 能力组织，而不是继续把旧版 `post-transaction/orders` 当作唯一主回执来源。[1] [2] [3] [4] 仓库此前在广播之后仍立即去打旧订单接口，并以 `txStatus === "2"` 作为主要完成条件，这会导致以下问题同时出现：一是新旧文档语义错位；二是前端难以按 `txHash` 继续查询；三是状态结构无法与新版文档中的字符串状态自然对齐。

### 3. 服务端、前端与回执层状态语言不统一

仓库同时存在 `prepared / broadcasted / success`、`requiresConfirmation`、`txStatus=2/4/5`、以及前端聊天卡片自定义语义几套并行描述方式。这样的设计在开发早期可以工作，但一旦进入真实广播与回执阶段，就会出现“服务端认为还在执行、前端却展示成功”或者“历史查询已经失败、卡片仍显示处理中”的问题。本轮审查确认，这种状态机碎片化是此前 Swap 主路径难以真正稳定落地的根因之一。

### 4. 聊天主链把 swap 的 `mockMode` 硬编码为 `true`

`chat-ai.ts` 中 swap 分支此前无论真实配置是否已经到位，都会把 `mockMode` 直接写死为 `true`。这会对上层 UI 与调试判断产生误导，因为即便底层已经接入真实 OKX 能力，聊天主线程仍会把自己描述成“模拟模式”。从系统观感上看，这会让用户误以为执行链尚未接通。

### 5. Swap 意图解析仍残留旧的 OpenAI 直连逻辑

虽然聊天主入口已经接入统一 LLM 层并切到 GLM 5.1，但 `dex-swap.ts` 自己的 `parseSwapIntent` 仍直接依赖 OpenAI 官方接口与 `OPENAI_API_KEY`。这会造成两个后果：第一，Swap 意图识别与聊天主入口的模型、网关和异常处理机制不一致；第二，在未配置 `OPENAI_API_KEY` 的本地环境中，它会退回正则解析，从而产生“聊天页能理解，Swap 子链却理解失败”的割裂体验。

## 四、本轮已完成的修正

本轮修正不是停留在报告层面，而是已经直接落到了仓库实现中。

| 问题 | 已完成修正 | 影响 |
|---|---|---|
| 真实凭证误判 | 在 `server/_core/dex-swap.ts` 与 `api/dex/index.ts` 中兼容 `OKX_DEX_*`、`OKX_API_*`、`OKX_ONCHAIN_*` 多套别名 | 降低因为命名不一致导致的 mock 误判 |
| 回执主链仍偏旧 | 执行后优先改为使用 `txHash` 调 `v6 history`，必要时才回退旧订单接口 | 与新版 DEX / Onchain OS 文档保持一致 [1] [2] [3] [4] |
| phase 映射不完整 | 在 `onchain-os.ts` 与前端 API 类型中补入 `failed` 分支 | 失败状态可被主线程、卡片与轮询一致承接 |
| 回执轮询缺少 `txHash` | `api/onchain/index.ts`、`lib/_core/api.ts`、`app/(tabs)/chat.tsx` 已补齐 `txHash` 透传 | 前端可直接按链上回执继续查状态 |
| swap `mockMode` 被写死 | `server/_core/chat-ai.ts` 已改为基于真实 OKX 配置动态判定 | 聊天主链不再误报 mock |
| 意图解析入口割裂 | `server/_core/dex-swap.ts` 已接入统一 LLM 层 | GLM 5.1 已覆盖 Swap 意图解析链 |

## 五、验证结果

### 1. 静态校验

本轮修改后已执行 `pnpm check`，`tsc --noEmit` 通过，说明本轮改动没有引入新的类型错误。

### 2. 脚本级烟雾测试

现有脚本 `scripts/test_agent_wallet_swap_flow.ts` 已再次执行。二次结果可以拆成两部分理解。

其一，**意图解析链已经收敛成功**。在把 `dex-swap.ts` 切到统一 LLM 层后，`parseBuy` 与 `parseSwap` 都能稳定返回 `action: "swap"`，并正确解析出 `amount`、`fromSymbol`、`toSymbol` 与 `chainKind`。这说明当前 **GLM 5.1 已经覆盖聊天主入口与 Swap 子链的自然语言理解主路径**。

其二，**真实 OKX 执行联调仍被本地环境阻塞**。脚本输出里 `preview` 与 `executePrepared` 仍显示 `providerMode: "mock"`、`mockMode: true`。经进一步检查，当前本地 `.env` 实际只有 GLM 配置，不包含任何真实 OKX DEX / Onchain OS 私有凭证，因此代码只能进入 mock。这意味着本轮不能在本地直接证明真实 Swap 已跑通，但已经能够证明：当前剩余问题主要位于环境注入，而不再是执行链代码本身。

| 验证项 | 结果 | 说明 |
|---|---|---|
| `pnpm check` | 通过 | 本轮改动未引入新的 TypeScript 问题 |
| Swap 意图解析 | 通过 | 已走统一 LLM 层，GLM 5.1 返回正确结构化结果 |
| 预览链真实联调 | 未完成 | 本地缺少 OKX 私有凭证，仍走 mock |
| 执行链真实联调 | 未完成 | 与上同，环境阻塞而非代码主链阻塞 |
| 广播后回执按 `txHash` 查询 | 代码已完成 | 需待真实凭证注入后做在线验证 |

## 六、仍需继续补齐的事项

接下来如果要完成用户所要求的“全部对接好之后，再一个一个来测试”，建议按下面顺序推进。

首先，应在**本地或部署环境补齐真实 OKX Onchain OS / DEX 凭证**，至少需要一套可用于 DEX v6 的 API Key、Secret、Passphrase，必要时再补 `Project ID`。只有这样，`previewOnchainSwap` 与 `executeOnchainSwap` 才能真正离开 mock 分支，进入官方已封装的真实能力路径。[1] [2] [3]

其次，应在有真实凭证后做四段式联调：一段验证报价是否返回真实 `routerResult / tx / gas`；二段验证待确认执行是否生成真实交易载荷；三段验证广播后是否返回稳定 `txHash`；四段验证 `receipt` 是否能通过 `history` 正确收敛到 `success` 或 `failed`。这一步建议直接复用现有测试脚本扩成更细的断言版，而不是只看控制台输出。

最后，应把本轮仍未彻底收敛的一些外围事项继续处理，例如把 `source: "openai"` 这样的历史字段命名同步收敛为更中性的 `llm`，再例如对 `api/dex/index.ts` 中的 serverless 提示文案和调试输出做一次统一清理，以减少后续排障噪音。

## 七、总体评价

如果把当前海豚社区 App 的 OKX Swap 集成成熟度分成三个层次来看，那么此前仓库大致停留在“**结构骨架已形成，但真实主链尚未完全对齐官方契约**”的状态；本轮修改之后，代码已经提升到“**主链模型、回执语义、聊天承接与文档契约基本一致，只差真实私有环境变量完成最后联调**”的阶段。

换言之，当前最重要的结论不是“Swap 还没接好”，而是“**代码层面的主要错位点已经被收敛，剩余最大阻塞是环境而不是架构**”。这对后续排期非常关键，因为它意味着下一轮工作应从“大规模重构”转向“真实凭证注入 + 分段联调 + 回归验证”。

## References

[1]: https://web3.okx.com/zh-hans/onchainos/dev-docs/trade/dex-api-introduction "OKX Onchain OS - DEX API 介绍"
[2]: https://web3.okx.com/zh-hans/onchainos/dev-docs/trade/dex-swap-api-introduction "OKX Onchain OS - 兑换 API 介绍"
[3]: https://web3.okx.com/onchainos/dev-docs/trade/dex-api-reference "OKX Onchain OS - DEX API Reference"
[4]: https://web3.okx.com/onchainos/dev-docs/trade/dex-get-quote "OKX Onchain OS - Get Quotes"
