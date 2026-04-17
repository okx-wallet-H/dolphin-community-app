# X Layer Builder Code 钱包提供方文档要点

- 文档页面：`https://web3.okx.com/xlayer/docs/developer/builder-codes/wallet-providers`
- 结论一：**钱包侧**需要在 `wallet_sendCalls` 的 `capabilities` 字段中接受 `dataSuffix`。
- 结论二：当钱包构造真实交易时，需要把 `dataSuffix.value` 追加到交易 `calldata`；对于 EOA 交易，若是原生转账也要把 `tx.data` 默认成 `0x` 后再追加后缀。
- 结论三：ERC-4337 User Operation 目前**不支持**该方式。
- 结论四：钱包可以把自己的 Builder Code suffix 放在应用 suffix 前面，实现 wallet + app 双 attribution。
- 这意味着：如果海豚社区 App 要在 **App 内 Agent Wallet 直接发送交易**，真实注入位点就不在后端 DEX execute API，而在移动端钱包发送方法（优先关注 `wallet_sendCalls`，其次关注内部封装的 `sendTransaction` / provider request）。

补充查阅 Builder Codes 概览文档后，可以进一步确认三点。第一，X Layer Builder Codes 是一个 16 字符 code，对应 ERC-721 NFT；交易发送时会在 calldata 尾部追加 **ERC-8021 attribution suffix**，且该后缀仅供链下索引器提取，不影响合约执行。第二，官方再次强调应用通常通过发送客户端配置 `dataSuffix`，或者在钱包支持时由钱包在签名前追加后缀；EOA 与 ERC-7702 smart wallet 支持，ERC-4337 暂不支持。第三，概览页**没有**给出从 builder code 直接计算十六进制 suffix 的算法或固定映射，只说明需要遵循 integration / wallet provider guide。因此，在当前仓库中，若没有可复用的官方 SDK 或现成 provider capability 实现，就不能安全地“自行发明” suffix 编码规则；更稳妥的做法是先把 Builder Code 作为配置与能力参数向 App 内真实发送层透传，并在发送层真正支持 `dataSuffix` 能力时再完成最终注入。[1]

[1]: https://web3.okx.com/zh-hans/xlayer/docs/developer/builder-codes/overview "Builder Codes | X Layer Documentation"

继续查阅 Integrate Builder Codes 文档后，官方要求已经足够明确。对于**应用侧**，推荐在**真正发送交易的钱包客户端**上统一配置 `dataSuffix`，优先方案是使用 `viem >= 2.45.0`，并通过 `ox/erc8021` 的 `Attribution.toDataSuffix({ codes: [builderCode] })` 生成后缀，再把该值配置到 `createWalletClient({ dataSuffix })`，或者在单笔 `sendTransaction({ dataSuffix })` 时显式传入。文档还给出了 wagmi 方案：需要自定义 connector 返回带 `dataSuffix` 的 client，才能确保 `useSendTransaction` 最终使用的就是带归因能力的钱包客户端。这个结论意味着，若我们要把 Builder Code 真正落到**App 内 Agent Wallet 发送链路**，就不能只在后端广播接口或外部确认页参数层面透传；必须在移动端真正发起 `sendTransaction` / 钱包 client 请求的那一层接入 `viem` 或兼容 provider capability 的实现，并把 `Attribution.toDataSuffix` 生成的值附着到该发送客户端或该笔交易上。换言之，当前仓库里仅有的“待确认上下文透传”只能算准备动作，真正的闭环依赖 App 内存在一个可控的钱包发送 client。[2]

[2]: https://web3.okx.com/zh-hans/xlayer/docs/developer/builder-codes/integration "Integrate Builder Codes | X Layer Documentation"
