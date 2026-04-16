# OKX Agent Trade Kit 参赛版部署说明

## 项目定位

本项目是为 OKX Agent Trade Kit 交易赛单独建立的独立脚本工程，与 H Wallet 主线代码隔离。其目标是复用既有 AI 分析能力，但把交易执行层切换为 Agent Trade Kit，以满足比赛要求。

## 目录说明

| 路径 | 作用 |
| --- | --- |
| `src/index.ts` | 主策略入口，负责分析、决策、下单、监控与事件驱动重分析 |
| `src/cli-utils.ts` | Agent Trade Kit CLI 调用封装 |
| `src/technical-indicators.ts` | 技术指标计算模块 |
| `src/market-sentiment.ts` | 市场情绪分析模块 |
| `SKILL.md` | 参赛 Skill 说明 |
| `TEST_RESULT.md` | 小仓位实盘测试结果 |

## 环境要求

建议使用 Node.js 22 及以上版本，并确保本地可以正常执行 Agent Trade Kit CLI。若首次部署，需要先安装依赖，并准备好 OKX 子账户 API Key、Secret 与 Passphrase。

## 安装步骤

在项目目录执行依赖安装：

```bash
pnpm install
```

如果需要重新构建本地 vendor 版 Agent Trade Kit，可进入 vendor 目录执行其构建流程。当前项目已针对比赛标签要求做了最小补丁，确保默认订单标签为 **agentTradeKit**。

## 配置说明

本项目默认读取本地 OKX 配置文件中的 `contest` profile。配置文件路径为：

```text
~/.okx/config.toml
```

示例结构如下：

```toml
[profiles.contest]
api_key = "YOUR_API_KEY"
secret_key = "YOUR_SECRET_KEY"
passphrase = "YOUR_PASSPHRASE"
environment = "live"
```

部署时应确保该 profile 对应的是比赛专用子账户，而不是主账户。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run check` | 进行 TypeScript 类型检查 |
| `npm run start` | 启动一次策略执行 |
| `npm run start -- --test-cycle` | 执行完整测试流程，包括监控与事件驱动验证 |

## 运行逻辑

正常运行时，脚本会依次分析 **BTC-USDT-SWAP、ETH-USDT-SWAP、SOL-USDT-SWAP** 三个标的，综合技术指标与市场情绪后，只选择最强候选项执行。若没有明确趋势，则保持观望。若存在仓位关闭事件，则系统会立即重新分析，而不等待下一个定时周期。

## 风控建议

在当前测试阶段，建议继续遵守以下原则：

1. 单笔风险预算不要超过总资金的 **20%**。
2. 杠杆优先控制在 **2 到 3 倍**。
3. 每次正式调整参数后，先运行一次 `--test-cycle` 验证链路。
4. 若连续出现异常资金费率或累计回撤扩大，应暂停自动交易并检查策略状态。

## 上线建议

在正式持续运行前，建议先观察至少 **1 到 2 个完整 4 小时周期**。若标签、止损止盈、持仓监控与事件驱动行为持续稳定，再切换为定时守护方式运行。
