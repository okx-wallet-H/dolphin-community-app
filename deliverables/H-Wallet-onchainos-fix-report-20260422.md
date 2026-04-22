# H Wallet 按 OKX OnchainOS 官方文档完成的行情与 Agent Wallet 链路修复报告

作者：**Manus AI**  
日期：2026-04-22

## 一、修复结论

本轮已围绕你指出的两个核心故障进行收口：其一是**多数行情无法查询**，其二是**交易链路在 Web 预览里经常停在“无地址/不可执行”状态**。结合你补充的 OKX OnchainOS DEX AI、MCP Server、Market AI、WebSocket、Portfolio、Tx History、Agentic Wallet 与 Balance API 文档，我把当前项目里最直接的阻塞点修到了可以继续上线联调的状态。[1] [2] [3] [4] [5] [6] [7] [8]

本次修复的重点不是继续叠加演示逻辑，而是把前端实际请求重新对齐到**单一可信的 Agent Wallet 后端域**，把客户端当前用户恢复逻辑改为**优先走 Agent Wallet 专属会话接口**，并把行情查询从原先的**少量硬编码 symbol 白名单**扩展为**优先 MCP/链上，失败后回退更通用的 OKX 公共现货 ticker symbol 查询**。同时，遗留的 `send-otp` 歧义入口已被显式停用，避免旧入口继续把登录态分叉到错误路径。

## 二、本轮实际修改

| 模块 | 修改内容 | 解决的问题 |
|---|---|---|
| `constants/oauth.ts` | 重写 `getApiBaseUrl()` 规则；本地开发时允许 `8081 -> 3000`，Manus 预览统一回落到已验证的 Vercel Agent Wallet API 域 | 修复前端静态页和后端 API 落在不同域、导致登录后 `getMe()` 仍恢复不出真实钱包地址的问题 |
| `lib/_core/api.ts` | `getMe()` 改为优先请求 `/api/agent-wallet/me`，仅在必要时回退 `/api/auth/me`；扩展 `getOkxPublicTickerPrice()` 与 `getPublicMarketSnapshot()` 的候选 `instId`；`getMarketSnapshotByMcp()` 在无链上映射或 MCP 失败时回退公共行情 | 修复“多数行情查不到”与“会话虽然登录但交易前仍提示无地址”的两个直接客户端根因 |
| `api/agent-wallet/verify.ts` | serverless verify 改为使用 `sdk.createSessionToken()` 签发标准会话，而不是自造 JWT | 修复登录成功后专属 `/api/agent-wallet/me` 无法正确识别会话的问题 |
| `api/agent-wallet/send-otp.ts` | 改为返回 `410` 停用提示，明确要求改用 `/api/agent-wallet/send-code` | 清除遗留/错误登录入口，避免 Agent Wallet cutover 后继续分叉 |
| `tmp/runtime_audit_notes_20260422.md` | 追加本地修复版浏览器复测记录 | 保留运行时验证证据，方便后续继续联调 |

## 三、为什么这几处修改是当前最关键的

此前你问“为什么其他行情查不到，也交易无法交易”，代码级根因其实是两层叠加。第一层是**行情查询层过窄**：聊天与公共行情快照在多个位置仍然依赖有限 symbol 映射，超出这份映射的资产会直接被判定为“不支持查询”，这与 OKX OnchainOS 文档强调的面向更广市场数据/工具能力的接入方向不一致。[3] [4]

第二层是**Agent Wallet 会话恢复链路分裂**。Web 预览环境原先会把 8081 前端推导到 3000 子域，而当前真实可用的 Agent Wallet 后端却在已验证的 Vercel 域上。于是前端即使完成了一次登录，后续 `getMe()` 仍可能请求到错误域或错误会话格式，最终在聊天交易前被判断为“没有恢复出真实 Agent Wallet 地址”。这也是你看到“意图识别没问题，但交易无法真正执行”的最直接原因。[5] [6] [7]

> OKX Agentic Wallet 文档强调的是**围绕统一钱包上下文恢复账户能力**，而不是让前端在多个历史入口之间自行猜测当前会话。[5] [6] [7]

## 四、自动化验证结果

| 检查项 | 结果 | 说明 |
|---|---|---|
| `pnpm tsc --noEmit` | 通过 | 本轮修复未引入新的类型错误 |
| `pnpm test` | 通过 | `5 passed, 1 skipped`，现有回归测试继续通过 |
| `pnpm lint` | 通过但有历史 warning | 本轮没有新增 error，仍保留仓库原有 warning |

## 五、浏览器与本地运行时复测结果

本轮已启动本地修复版 Web 预览并完成基础复测。聊天页能够正常加载，说明本轮会话与行情改动没有造成前端崩溃。随后我在本地修复版中提交了 `DOGE 价格` 作为非原始白名单 symbol 的验证样例。当前浏览器侧已看到用户消息正常入列，但由于本地浏览器并未处于登录态，且 `/api/chat/intent` 直接请求返回 `{"error":"Not authenticated"}`，因此这一轮本地运行时只能确认**UI 提交链路正常**，不能把它算作一条完整的已登录行情返回验证。

换言之，**代码层直接根因已经修掉**，但如果要把“DOGE 价格返回正常”和“一句话交易从待确认走到真实成交回执”两项都做成最终演示级验证，还需要在修复版环境里重新完成一次 Agent Wallet 登录，确保浏览器持有新的标准会话 cookie 后再跑端到端复测。

## 六、当前仍需你知晓的剩余风险

| 风险 | 当前状态 | 建议 |
|---|---|---|
| 已登录态端到端交易成交验证 | 尚未在本地修复版完成 | 重新登录 Agent Wallet 后复测 `100 USDT 换 ETH` 或 `3U 买 BNB` |
| 非 OKX 现货 ticker 体系内的极长尾 symbol | 仍不保证全部可查 | 后续应补充更完整的 token search / symbol resolve 能力，优先对齐 OKX Market AI / token search 正式接口 |
| 真正的“无需用户干预自动签名广播” | 当前代码未新增托管签名能力 | 如需完全无交互成交，需要继续接入 OKX 官方的 Agent Wallet / 交易执行能力，而不能只停留在交易构建层 |
| 历史 lint warning | 仍存在 | 可作为下一轮代码卫生收口项 |

## 七、建议的下一步

下一步最值得做的不是再回头补演示字符串，而是直接把修复后的代码推到你当前的联调环境，然后用**同一个 Agent Wallet 账号重新登录一次**。完成这一步后，应该优先验证三件事：第一，聊天页是否还会提示“当前会话还没恢复出真实 Agent Wallet 地址”；第二，`DOGE 价格` 这类超出旧白名单的 symbol 是否已能返回公共 ticker 结果；第三，一句话交易是否至少能稳定进入**真实待确认状态**而不是在提交前被地址缺失拦截。

如果你愿意，我下一步可以直接继续做两件事之一：要么把这批修复整理成可提交的 Git 提交并继续推送；要么在你重新登录一次修复版环境后，我继续替你做端到端浏览器复测，把“行情扩展”和“交易恢复”验证闭环补完整。

## References

[1]: https://web3.okx.com/zh-hans/onchainos/dev-docs/trade/dex-ai-tools-introduction "OKX OnchainOS DEX AI Tools Introduction"
[2]: https://web3.okx.com/zh-hans/onchainos/dev-docs/trade/dex-ai-tools-mcp-server "OKX OnchainOS DEX AI Tools MCP Server"
[3]: https://web3.okx.com/zh-hans/onchainos/dev-docs/market/market-ai-tools-introduction "OKX OnchainOS Market AI Tools Introduction"
[4]: https://web3.okx.com/zh-hans/onchainos/dev-docs/market/websocket-channels "OKX OnchainOS Market WebSocket Channels"
[5]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/product-and-service "OKX OnchainOS Wallet Product and Service"
[6]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/agentic-wallet "OKX OnchainOS Agentic Wallet"
[7]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/install-your-agentic-wallet "OKX OnchainOS Install Your Agentic Wallet"
[8]: https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/balance-api-overview "OKX OnchainOS Wallet Balance API Overview"
