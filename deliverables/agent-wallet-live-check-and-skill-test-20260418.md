# Agent Wallet 实测结果：3U 到账查询与其他能力测试

本次我围绕你刚刚提出的两个目标做了实测。第一部分是确认你刚转入的 **3U 是否到账**；第二部分是对当前 **Agent Wallet 其他可测能力** 做一轮在线验证，判断哪些已经能跑、哪些还只是半成品。

## 一、到账结论

先说结论：**这 3U 很大概率已经到账，但不是到账在 X Layer，也不是到账在 Base，而是到账到了同一 EVM 地址在 `BNB Chain` 上的稳定币资产里。**

当前我确认过的真实 Agent Wallet 地址如下。

| 地址类型 | 地址 |
|---|---|
| EVM 地址 | `0x65a92c1c5da328ae028e80c4fb2bfb223f652669` |
| Solana 地址 | `D7NLQ4Py73sCT56688m6TP9cjNMJjGqngqdrLsHUy55Y` |

我先在 **X Layer 浏览器**检查了这个 EVM 地址。页面显示该地址当前 **总资产为 0、USDT 持仓为 0、并且没有任何交易记录**。这说明如果你认为资金是打到 X Layer 上，那么截至查询时并没有看到这笔 3U。

随后我又在 **BaseScan** 上查看了同一个地址。Base 主地址页同样显示 **ETH 余额为 0，交易记录为空**。但是它的 **Multichain Portfolio** 模块明确显示，这个地址名下存在 **$3 的跨链资产**，并且资产明细指向：

| 项目 | 查询结果 |
|---|---|
| 多链总资产 | `$3` |
| 所在链 | `BNB Chain` |
| 代币 | `Binance-Peg BSC-USD (BSC-USD)` |
| 数量 | `3` |
| 估值 | `$3` |

因此，当前最可靠的判断是：

> **你转入的 3U 已经进入这只 Agent Wallet 对应的 EVM 地址体系，但当前落在的是 BNB Chain 上的 BSC-USD，而不是 X Layer / Base 侧的 USDT。**

这也解释了为什么你在我们前面重点检查的 X Layer 路径上看不到到账。

## 二、我额外测试了哪些 Agent Wallet 能力

为了避免只看代码不看真实线上，我又直接拿当前验证通过的真实会话，对线上能力做了实际调用测试。结果如下。

| 测试项 | 结果 | 说明 |
|---|---|---|
| 邮箱验证码登录主链路 | 成功 | 之前已完成实测，能返回真实 EVM + Solana 地址，且 `mockMode: false` |
| `onchain config` | 成功 | 能返回 Agent Wallet 执行模型、能力标志和端点配置 |
| `onchain assets` | 成功返回，但数据是 mock | 接口通了，但返回空资产和 `mockMode: true` |
| `onchain preview` | 成功 | 可生成 Swap 预执行摘要与确认阶段进度 |
| `onchain execute` | 失败 | 线上执行阶段报错：`ENOENT: no such file or directory, mkdir '/var/task/data'` |
| `agent-wallet me` | 失败 | 线上返回 `NOT_FOUND`，说明这个路径没有作为 serverless 正常暴露 |

## 三、逐项解释

### 1. 配置能力已经能返回，但运行模式仍不完整

`onchain config` 返回了如下关键特征：

| 字段 | 实测值 |
|---|---|
| `providerMode` | `mock` |
| `executionModel` | `agent_wallet` |
| `authMode` | `api_key` |
| `capabilities.walletEmailLogin` | `true` |
| `capabilities.preview` | `true` |
| `capabilities.execute` | `true` |
| `capabilities.receipt` | `true` |
| `capabilities.assets` | `true` |
| `capabilities.simulate` | `true` |
| `capabilities.broadcast` | `true` |

从产品角度看，这表示 **后端配置层宣称这些能力都存在**。但“配置里写了 true”并不等于“线上真实可用”。后面的实测已经证明：有些能力只是配置通了，真正运行时还没有打透。

### 2. 资产接口已经通，但当前线上仍返回 mock 资产

我直接调用了 `onchain assets`。接口本身是能返回成功包的，但结果里是：

| 字段 | 实测值 |
|---|---|
| `source` | `mock` |
| `mockMode` | `true` |
| `totalAssetValue` | `0.00` |
| `walletAddresses[0].chainName` | `X Layer` |
| `assets` | 空数组 |

这说明一个很关键的问题：

> **当前 Agent Wallet 的登录主链路虽然已经是真实钱包，但资产聚合接口在线上环境仍没有切到真实资产源，所以 App 内部资产查询并不能准确反映你刚转入的 3U。**

换句话说，**钱到了，但 App 自己的资产接口现在还看不见。**

### 3. Preview 能跑，说明“预执行摘要”链路是通的

我用一笔安全的只读测试请求做了 `Swap preview`。返回成功，包含以下内容：

| 能力点 | 实测表现 |
|---|---|
| 预执行请求 | 成功返回 |
| `phase` | `preview` |
| `progress` | 已生成摘要 → 等待确认 → 等待广播 |
| `approvalRequired` | `true` |
| `quote` | 已返回模拟报价 |
| `mockMode` | `true` |

这说明：**预执行和确认卡片生成这条链路是能跑起来的**，但当前仍基于 mock provider，不是真实可成交报价。

### 4. Execute 线上仍然是坏的

我继续测试了 `execute`。结果并不是业务层拒绝，而是直接报了部署级错误：

> `ENOENT: no such file or directory, mkdir '/var/task/data'`

这说明问题不在用户输入，也不在 Agent Wallet 本身，而在于：

| 问题类型 | 说明 |
|---|---|
| 部署运行时问题 | serverless 环境里试图写入 `/var/task/data` |
| 影响 | 执行阶段无法正常创建持久化或中间目录 |
| 结果 | 真正执行链路被运行时错误拦截 |

所以当前必须明确：

> **Agent Wallet 的 execute 能力在配置层显示存在，但线上实测仍不可用。**

### 5. `/api/agent-wallet/me` 当前没有正确暴露

我也直接测试了当前用户查询接口 `/api/agent-wallet/me`。线上返回的是 `NOT_FOUND`，不是鉴权失败，也不是 405，而是路由根本没被正确发布出来。

这说明：

| 现象 | 结论 |
|---|---|
| `NOT_FOUND` | 该路径当前没有正常作为线上 serverless 暴露 |
| 影响 | App 想依赖这个接口恢复或校验会话时会出问题 |
| 风险 | 真实登录链路和会话查询链路没有完全对齐 |

## 四、结合这次实测，Agent Wallet 现在的真实状态

如果只从“真实可用性”角度来讲，当前 Agent Wallet 应该这样理解。

| 能力 | 当前真实状态 |
|---|---|
| 邮箱验证码登录 | 可用 |
| 真实钱包地址下发 | 可用 |
| 链上到账接收 | 可用，但资产可能落在非预期链上 |
| App 内资产展示 | 不准确，当前仍偏 mock |
| Swap 预览 | 可用，但偏 mock |
| Swap 执行 | 当前不可用，线上报运行时错误 |
| 当前用户查询 | 当前不可用，路由未暴露 |
| 签名后续跑 | 代码有，但要等 execute 真正打通后才有完整意义 |

## 五、我给你的直接结论

你现在最应该记住的是三句话。

第一，**你刚转的 3U 没丢**，我已经查到它以 **BNB Chain 上的 BSC-USD** 形式挂在这只 Agent Wallet 的同一 EVM 地址体系下。

第二，**为什么 App 里可能还看不到这 3U**，不是因为没有到账，而是因为当前 App 的 `assets` 查询仍在走 mock 结果，尚未真正接入你这只钱包的真实多链资产聚合。

第三，**其他技能我也已经帮你测了**。目前真正能稳定跑的是 **登录、地址返回、配置读取、preview 预执行**；而 **assets 是假数据、execute 直接报部署错误、me 查询接口没发出来**。

## 六、建议下一步

| 优先级 | 建议动作 | 原因 |
|---|---|---|
| P0 | 先修 `assets` 真实资产源 | 否则你入金了，App 里仍然显示 0 |
| P0 | 修 `execute` 的 `/var/task/data` 写目录问题 | 否则真正交易执行链路永远跑不通 |
| P0 | 把 `/api/agent-wallet/me` 做成和登录链路一致的 serverless 暴露 | 否则会话恢复不稳定 |
| P1 | 增加“资金到账链识别”与“当前钱包支持链提示” | 避免用户转到了 BNB Chain，但前端只盯着 X Layer |

如果你愿意，我下一步可以继续直接帮你做两件事中的任意一件：**第一，继续追这笔 3U 的具体链上转账 hash；第二，直接开始修 assets / execute / me 这三个线上问题。**
