# H Wallet 真数据接入线索整理

在原仓库 `/home/ubuntu/new-h-wallet` 中，已经存在可直接迁移的真实数据实现。当前阶段的关键结论如下。

| 模块 | 位置 | 结论 |
| --- | --- | --- |
| 聊天实时价格 | `lib/_core/api.ts` 第 1127 行附近 | 已实现 `getRealtimeMarketSnapshot(symbol)`，优先调用 OKX Onchain 实时价格，失败后回退到 OKX 公共 ticker。 |
| 聊天意图接口 | `lib/_core/api.ts` 第 1377 行附近 | `parseChatAiIntent({ message, wallet })` 通过 `/api/chat/intent` 返回结构化意图结果。 |
| 聊天后端逻辑 | `server/_core/chat-ai.ts` | 已包含“查价格”意图识别与 `BTC/ETH/SOL/USDT` 实时价格回答，优先 OKX Onchain，再回退 OKX ticker。 |
| 钱包真实余额 | `lib/_core/api.ts` 第 1322 行附近 | `getAccountAssets(wallet)` 会基于 EVM RPC、Solana RPC、OKX Onchain token detail、OKX price 与 CoinGecko 兜底价聚合真实资产。 |
| 钱包 UI 参考 | `app/(tabs)/wallet.tsx` | 已实现从本地 `hwallet-agent-wallet` 读取地址、刷新资产、错误态和刷新事件联动。 |
| Agent Wallet 登录 | `server/_core/agent-wallet-routes.ts` | 提供 `/api/agent-wallet/send-otp`、`/api/agent-wallet/verify`、`/api/agent-wallet/me` 等接口。 |

当前后端首页 `https://new-h-wallet-api.vercel.app/` 仅返回健康检查 JSON：`{"ok":true,"timestamp":1776141620648}`，并未公开列出文档，因此应以原仓库实现为准进行迁移。

下一步建议是将原仓库中的 `lib/_core/api.ts` 里与 `getAccountAssets`、`getRealtimeMarketSnapshot`、`parseChatAiIntent` 相关的类型与工具函数整理后迁入重构工程，再把 `app/(tabs)/chat.tsx` 与首页 `app/(tabs)/index.tsx` 改造成基于真实数据的状态驱动界面。
