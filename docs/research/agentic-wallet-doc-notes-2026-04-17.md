# Agentic Wallet 文档要点

文档页面为 `https://web3.okx.com/onchainos/dev-docs/wallet/agentic-wallet`。文档明确指出，**Agentic Wallet 是专为 AI Agent 设计的链上钱包**，其目标是让 Agent 具备持有资产、签名和发起交易的能力。文档同时强调私钥生成、存储和签名均在 TEE 安全环境内完成，Agent 与 OKX 都不能直接触达私钥。

从能力边界看，Agentic Wallet 并不是单纯的后端报价工具，而是承担真实链上执行的钱包能力层。文档写明其覆盖 X Layer、Ethereum、Solana 等主流链，并支持交易与转账；同时交易执行前带有风险模拟评级、身份核验、黑地址拦截与风险代币预警。这说明如果海豚社区 App 按“App 内 Agent Wallet 直接完成 Swap 与发送”路径推进，那么 Builder Code 的真实注入位点应优先围绕 Agentic Wallet 的发送请求结构、钱包能力调用参数以及对应的链上广播承接层来设计，而不是仅停留在后端 DEX execute API。

从交易上链文档可进一步确认，Agentic Wallet / 钱包 API 的真实广播接口是 `POST /api/v6/dex/pre-transaction/broadcast-transaction`。其核心输入是 `signedTx`、`chainIndex` 和 `address`，并可通过 `extraData` 传递额外广播参数，例如 `enableMevProtection`；Solana 场景还要求同时提供 `jitoSignedTx`。这一层职责说明当前 OKX Onchain OS 的后端广播接口本质上接收的仍是**已经完成签名的交易字符串**，因此如果要满足 X Layer Builder Code 文档关于 `dataSuffix` 的要求，后缀必须在**签名前**就被注入到待签名交易的 `data/calldata` 中，而不是在广播阶段再追加。

这也意味着海豚社区 App 若采用“App 内 Agent Wallet 完成 Swap 与发送”的模式，必须继续向前追溯到**待签名交易生成与钱包发送方法**这一层：要么在 App 内部对接 `wallet_sendCalls` 风格能力并在 `capabilities.dataSuffix` 中显式传入 Builder Code 对应后缀，要么在构造待签名 EOA 交易时于本地将 `tx.data` 追加 `dataSuffix` 后再交由 Agent Wallet 完成签名与广播。单纯改造后端 `broadcast-transaction` 接口并不能完成 Builder Code 真实注入。

进一步查阅 DEX `GET /api/v6/dex/aggregator/swap` 文档后，可以确认两点。第一，Swap 接口本身返回的是**用于签名的交易数据**，并不是最终链上广播结果；文档中出现了完整的 EVM 交易字段片段，至少包含 `tx.data`、`from`、`gas`、`gasPrice`、`maxPriorityFeePerGas` 等内容，这与当前服务端 `swapTransaction` 语义一致。第二，文档明确提供了 `callDataMemo` 参数，允许调用方“自定义 callData 中上链携带的参数”，要求为固定 64 bytes、128 个十六进制字符长度并保留 `0x` 前缀。这说明在 OKX DEX 体系内，**对 callData 的附加参数注入本来就是被支持的**，而 Builder Code 所要求的 `dataSuffix` 注入，本质上也应当发生在这一层——也就是待签名交易数据构造阶段，而不是广播阶段。

结合前面钱包提供方文档与 Agentic Wallet 广播文档，可以形成更清晰的映射：如果未来采用 `wallet_sendCalls` 能力，则 Builder Code 需要由 App 内发送客户端在能力参数中显式声明；如果当前仓库仍主要依赖 DEX `swap` 接口返回待签名交易，那么本轮更可落地的路径是先在服务端或客户端对 `swapTransaction.data` 建立**受控 dataSuffix / memo 注入骨架**，并将其作为签名前最后一跳的标准处理步骤。这样既能保留现有 Onchain / DEX 询价与广播流程，又能为后续接入 Agent Wallet 原生发送能力预留一致的 Builder Code 注入抽象。

Quickstart 文档进一步确认了产品级目标：安装并创建 Agentic Wallet 之后，用户为钱包充值，即可在**对话内直接完成代币兑换、余额查询和转账**，无需切换工具、无需手动签名。其示例流程明确分为“Agent 获取交易报价并请求确认”以及“用户确认后 Agent 广播交易”两个步骤。这说明 OKX 官方定义下的理想体验并不是当前仓库这种“深链打开外部确认页，再回到聊天页续跑广播”的形态，而是**聊天主线程内完成报价、确认、发送和结果回执承接**。

对海豚社区 App 的含义很直接：目前仓库的外部 `SIGNATURE_PORTAL_URL` 路径只能视为过渡实现；下一阶段应当把确认动作收回到 App 内，并把 Builder Code 注入逻辑绑定到 App 内真实发送适配层。只有这样，才能同时满足 Agentic Wallet Quickstart 所描述的产品体验，以及 X Layer Builder Code 文档要求的 `dataSuffix` / 能力参数注入位置。
