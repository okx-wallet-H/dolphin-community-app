# Skills | Agentic Wallet | Onchain OS 文档

首页
钱包
支付
交易
行情
DApp 连接钱包
介绍
功能与服务
支持的网络
AGENTIC WALLET
介绍
快速开始
Skills
钱包 API
介绍
查询余额
交易上链
查询交易历史
DEFI API
介绍
投资品查询
交易执行
用户持仓查询
错误码
钱包
Agentic Wallet
Skills
Skills#
复制文档
Markdown 视图
概述#

OKX Agentic Wallet 提供以下功能，覆盖从登录认证到链上交易执行的完整流程。用自然语言告诉 Agent 你要做什么，Agent 自动选择对应功能执行。

功能一览#
功能 说明
钱包登录认证 通过邮箱 或 API Key 认证登陆
钱包管理 支持创建最多 50 个子钱包
资产组合查询 多链余额查询、总资产估值、单币种余额，支持 17 条链
安全检测 Token 安全检测、DApp 钓鱼扫描、交易风控拦截、授权管理
转账发送 发送代币，支持批量转账，自动安全检测
交易历史 交易记录查询，支持按链 / 币种筛选
钱包登录认证#

通过邮箱验证码 或 API Key 登录钱包。

Shell
用邮箱登录我的钱包
# 调用 wallet-login → wallet-verify

Shell
用 API Key 登录钱包
# 调用 wallet-login (apikey 模式)

Shell
我现在登录了吗
# 调用 wallet-status

Shell
退出钱包登录
# 调用 wallet-logout

钱包管理#

创建、派生、切换钱包。每种登录方式最多派生 50 个子钱包，每个子钱包可同时生成 EVM 和 Solana 地址。

Shell
查看钱包状态
# 调用 wallet-status

Shell
查看所有钱包
# 调用 wallet-balance --all

Shell
帮我创建一个新的子钱包
# 调用 wallet-create

Shell
切换到第 2 个钱包
# 调用 wallet-switch

Shell
查看充值地址
# 调用 wallet-balance

Shell
在 Solana 上操作
# 调用 wallet-chains

资产组合查询#

登录后可查询自己或任意地址钱包的余额。

Shell
查一下我的余额
# 调用 wallet-balance

Shell
我有多少 OKB
# 调用 wallet-balance --token-address

Shell
查一下这个地址的资产 0x1234...
# 调用 portfolio-all-balances

Shell
这个地址总资产值多少
# 调用 portfolio-total-value

安全检测#

全方位安全防护，保障每笔操作安全。

Shell
这个 Token 安全吗？
# 调用 security-token-scan

Shell
这个网站安全吗？
# 调用 security-dapp-scan

Shell
帮我查查我的授权
# 调用 security-approvals

Shell
这笔交易安全吗？
# 调用 security-tx-scan

Shell
这个签名请求安全吗？
# 调用 security-sig-scan

转账发送#

发送代币到指定地址，支持批量归集。

Shell
发 0.1 ETH 到 0x1234...
# 调用 wallet-send

Shell
把所有钱包的 ETH 归集到 0x1234...
# 调用 wallet-balance --all → 逐个 wallet-send

交易历史#

查看交易记录，支持按链、币种、方向筛选。默认展示近 20 条，支持翻页。

Shell
帮我看看最近的交易记录
# 调用 wallet-history

Shell
查看 Arbitrum 上的交易
# 调用 wallet-history --chain

Shell
查看 USDC 转账记录
# 调用 wallet-history

Shell
只看转入
# 调用 wallet-history

Shell
帮我查一下这个交易 0xabc123...
# 调用 wallet-history --tx-hash

跨功能组合工作流#

单条指令可自动串联多个功能，Agent 自行规划执行顺序，无需手动拆分步骤。

Shell
帮我看看持仓，卖掉跌的
# 查持仓 → 分析 → 交易

Shell
帮我在 Solana 上找个有潜力的 meme 币买一点
# 搜代币 → 查安全 → 买入

Shell
帮我安全地执行这笔交易
# 查 Gas → 模拟 → 安全检测 → 执行 → 追踪

Shell
从主钱包转 10 USDC 到第 3 个钱包，然后用第 3 个钱包买 ETH
# 多钱包协作

Shell
帮我做一个全面的安全检查，完成后汇总报告
# 安全自查全流程

Shell
我想用 uniswap.org 做交易，安全吗？
# DApp 安全 + 交互
