# Agent Wallet 在线实测更新报告

本次我继续在当前环境中追查你转入的 **3U**，并补充验证了当前 **Agent Wallet** 其他可测能力的真实状态。结论已经比较明确：**这笔 3U 已经到账，但到账链不是 X Layer，而是 BNB Chain；同时，App 当前资产接口仍未真实反映这笔到账。**

## 一、3U 到账结论

当前已经确认的真实钱包地址如下。

| 地址类型 | 地址 |
|---|---|
| EVM | `0x65a92c1c5da328ae028e80c4fb2bfb223f652669` |
| Solana | `D7NLQ4Py73sCT56688m6TP9cjNMJjGqngqdrLsHUy55Y` |

我先检查了该 EVM 地址在 **X Layer 浏览器**上的公开数据，页面显示总资产为 `$0`、`USDT holdings = 0 USDT`，并且没有交易记录[1]。这说明如果按 X Layer 维度看，这笔 3U 并没有出现在该链上。

随后，我检查了同一地址在 **BaseScan** 上的多链资产视图。虽然 Base 链原生页面本身没有交易记录，但其 `Multichain Portfolio` 明确显示该地址存在 **$3** 资产，并且链别为 **BNB Chain**，资产为 **Binance-Peg BSC-USD (BSC-USD)**[2]。

在此基础上，我继续直接提取了 **BscScan** 的代币转账页数据，最终拿到了这笔到账的精确明细[3]：

| 字段 | 值 |
|---|---|
| 交易哈希 | `0xbdfd4674b63745fa540ef15f66117fe21577bf9ce216c57842928f1fb661ca49` |
| 状态 | `Success` |
| 方法 | `Transfer` |
| 区块 | `93202979` |
| 时间 | `2026-04-18 06:09:46` |
| 转出地址 | `0x29018d7e0dd00de315dd131fbe342817674430bd` |
| 转入地址 | `0x65a92c1c5da328ae028e80c4fb2bfb223f652669` |
| 代币 | `Binance-Peg BSC-USD (BSC-USD)` |
| 数量 | `3` |
| 估值 | `$3.00` |

> **因此，这笔 3U 并没有丢失，而是已经以 BNB Chain 上的 BSC-USD 形式成功转入当前这只 Agent Wallet 的 EVM 地址。**

## 二、为什么 App 里可能还看不到这 3U

为了确认问题不是出在链上，而是出在 App 当前接入层，我重新测试了线上 `assets` 能力。接口在补充 `address` 参数后可以正常返回，但返回内容仍然是 `source: mock`、`mockMode: true`，并且总资产还是 `0.00`，只列出 X Layer 地址且 `assets` 为空[4]。

这说明一个很关键的问题：

| 维度 | 当前状态 |
|---|---|
| 链上真实到账 | 已到账 |
| App 资产接口返回 | 仍为 mock |
| 是否能在当前 App 内正确看到这 3U | 不能保证 |

也就是说，**钱已经到账，但当前 App 自己的资产查询接口还没有切到真实多链资产源，因此它看不到这笔 BNB Chain 上的 3U。**

## 三、其他 Agent Wallet 能力实测结果

我同时补测了当前其他关键能力。结果如下。

| 能力项 | 实测结果 | 说明 |
|---|---|---|
| 邮箱验证码登录 | 成功 | 之前已验证可返回真实 EVM / Solana 地址 |
| `config` | 成功 | 能返回能力标志、执行模型与运行配置 |
| `preview` | 成功，但为 mock | 能生成预执行摘要和确认进度，但报价与审批数据是 mock |
| `assets` | 成功，但为 mock | 无法反映真实到账的 3U |
| `execute` | 失败 | 线上报 `ENOENT: no such file or directory, mkdir '/var/task/data'` |
| `/api/agent-wallet/me` | 不可用 | 当前线上返回 `NOT_FOUND` |

### 1. Config 层能力声明完整，但并不代表真实可用

在线 `config` 返回中，`walletEmailLogin`、`preview`、`execute`、`receipt`、`assets`、`simulate`、`broadcast` 都被标记为 `true`，执行模型为 `agent_wallet`，但 `providerMode` 仍然是 `mock`[5]。这意味着系统在配置层面“宣称”这些能力存在，但实际运行时并没有全部打通。

### 2. Preview 能跑，但还不是真实成交链路

我做了一次安全的只读 `preview` 测试，请求成功返回。结果中包含 `phase = preview`、进度状态、审批需求、手续费和报价信息，但同时明确返回 `mockMode: true`，并且底层 `raw.quote` / `raw.approve` / `raw.gas` 都带有 `mock` 标记[6]。

这说明：

> **当前 Agent Wallet 的“预执行摘要”能力可用，但还不是基于真实链上流动性与真实执行环境的生产能力。**

### 3. Execute 当前仍被部署级错误拦住

我进一步测试了 `execute`。结果不是业务逻辑拒绝，也不是余额不足，而是直接返回运行时错误：

> `ENOENT: no such file or directory, mkdir '/var/task/data'`[7]

这说明真正的执行链路当前仍然卡在 **serverless 运行时目录写入** 这一部署问题上。只要这个问题不修，Agent Wallet 的真实执行能力就无法正式可用。

## 四、当前可以确认的产品状态

结合这次继续追踪的结果，现在可以把 Agent Wallet 的真实状态概括成下面这张表。

| 能力 | 当前真实状态 |
|---|---|
| 真实邮箱登录 | 已可用 |
| 真实钱包地址下发 | 已可用 |
| 链上收款 | 已可用 |
| 多链到账识别 | 不完整，当前主要靠外部浏览器确认 |
| App 内资产展示 | 未打通真实资产源 |
| Swap 预执行 | 可用，但为 mock |
| Swap 执行 | 当前不可用 |
| 用户会话查询 | 路由未完整暴露 |

## 五、给你的直接结论

如果只回答你最关心的问题，那么当前最准确的说法是：

> **你刚转的 3U 已经到账。**
>
> **到账位置是 `BNB Chain` 上的 `BSC-USD`，对应交易哈希为 `0xbdfd4674b63745fa540ef15f66117fe21577bf9ce216c57842928f1fb661ca49`。**
>
> **之所以 App 里可能还看不到，不是因为没到账，而是因为当前 `assets` 接口仍在返回 mock 资产。**

## 六、建议下一步

从修复优先级看，接下来最值得马上处理的是下面三件事。

| 优先级 | 动作 | 原因 |
|---|---|---|
| P0 | 把 `assets` 从 mock 切到真实多链资产源 | 否则用户收到了钱，App 仍显示 0 |
| P0 | 修 `execute` 的 `/var/task/data` 写入问题 | 否则 Swap / 执行能力无法上线 |
| P0 | 补齐 `/api/agent-wallet/me` 路由 | 否则会话恢复与状态查询不稳定 |

## References

[1]: https://www.oklink.com/xlayer/address/0x65a92c1c5da328ae028e80c4fb2bfb223f652669 "OKLink X Layer Address 0x65a92c1c5da328ae028e80c4fb2bfb223f652669"
[2]: https://basescan.org/address/0x65a92c1c5da328ae028e80c4fb2bfb223f652669 "BaseScan Address 0x65a92c1c5da328ae028e80c4fb2bfb223f652669"
[3]: https://bscscan.com/tokentxns?a=0x65a92c1c5da328ae028e80c4fb2bfb223f652669 "BscScan Token Transfers for 0x65a92c1c5da328ae028e80c4fb2bfb223f652669"
[4]: https://new-h-wallet-api.vercel.app/api/onchain?route=assets&address=0x65a92c1c5da328ae028e80c4fb2bfb223f652669 "Live onchain assets response observed during testing"
[5]: https://new-h-wallet-api.vercel.app/api/onchain?route=config "Live onchain config response observed during testing"
[6]: https://new-h-wallet-api.vercel.app/api/onchain?route=preview "Live onchain preview response observed during testing"
[7]: https://new-h-wallet-api.vercel.app/api/onchain?route=execute "Live onchain execute response observed during testing"
