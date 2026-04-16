# AI智能合约网格策略引擎第二批交付说明

## 一、交付范围

本批次围绕**真实环境受控执行、私有监控、自动调参、最大回撤熔断、前端策略卡片、运行日志**六项能力展开，延续第一批的 OKX Grid Bot 混合方案：**OKX 负责执行底座，H Wallet 负责参数智能、风控与解释层**。

## 二、已完成能力

| 模块 | 本批完成内容 | 关键文件 |
| --- | --- | --- |
| 实盘密钥与灰度开关 | 新增 `OKX_API_KEY`、`OKX_API_SECRET`、`OKX_API_PASSPHRASE` 读取；支持受控实盘创建、改参、停策略；支持允许品种、最大预算、是否允许真实下单等灰度控制 | `server/_core/env.ts`、`server/_core/grid-runtime-config.ts`、`src/services/okx/grid-bot-service.ts`、`.env.example` |
| Grid Bot 私有监控 | 基于 `orders-algo-details` 与 `positions` 轮询更新策略状态、收益、仓位、保证金风险与运行时长 | `server/_core/grid-strategy-monitor.ts`、`server/_core/grid-strategy.ts` |
| 最大回撤熔断 | 支持最大回撤阈值、异常资金费率阈值配置；触发后自动停策略、写入熔断状态并记录日志 | `server/_core/env.ts`、`server/_core/grid-strategy-monitor.ts`、`server/_core/grid-strategy-store.ts` |
| 动态调参定时任务 | 新增守护任务，按周期执行监控轮询与市场再分析；根据结果输出 `hold/amend/pause` 并可自动执行改参 | `server/_core/grid-strategy-guard.ts`、`server/_core/index.ts` |
| 策略运行日志 | 记录创建、改参、停止、熔断、错误、调参决策等事件；同时持久化策略元数据、监控快照与日志 | `server/_core/grid-strategy-store.ts` |
| 前端 Chat 策略卡片 | 创建、查询、停止均返回结构化卡片；前端新增网格策略卡片渲染，展示参数、收益、解释与日志 | `server/_core/chat-ai-routes.ts`、`lib/_core/api.ts`、`app/(tabs)/chat.tsx` |

## 三、运行机制说明

### 1. 受控实盘执行

系统仅在以下条件同时满足时才允许真实变更：

| 条件 | 说明 |
| --- | --- |
| 已配置 OKX 私有密钥 | `OKX_API_KEY` / `OKX_API_SECRET` / `OKX_API_PASSPHRASE` |
| 灰度开关允许 | 受 `OKX_GRID_LIVE_TRADING_ENABLED` 等环境变量控制 |
| 品种在允许名单内 | 默认聚焦 `BTC-USDT-SWAP`、`ETH-USDT-SWAP` |
| 预算未超限 | 通过受控预算上限约束真实投入 |

未满足条件时，系统继续工作于**建议模式 / 受控模式**，生成参数卡片、分析卡片与日志，但不会真实下单。

### 2. 私有监控与熔断

监控服务会按周期拉取：

| 数据源 | 用途 |
| --- | --- |
| `orders-algo-details` | 获取策略运行详情、网格状态与关键执行信息 |
| `positions` | 汇总仓位、未实现盈亏、保证金风险、持仓数量 |

系统会把监控结果落盘，更新：**累计收益、收益率、运行时长、仓位数、未实现盈亏、平均保证金率、最大回撤比例**。当回撤超过阈值时，自动进入熔断流程：**停策略、记日志、持久化熔断状态、发送通知入口**。

### 3. 动态调参守护任务

守护任务启动后，会自动运行两类周期：

| 周期任务 | 作用 |
| --- | --- |
| 监控轮询 | 刷新运行指标、检测风险、必要时触发熔断 |
| 再平衡调参 | 重新分析市场状态，根据 `hold/amend/pause` 决策执行自动改参或暂停 |

调参决策会被记录为结构化日志，包含：**决策动作、原因、置信度、风险提示、市场状态、优化后参数、改参载荷**。

## 四、前端 Chat 展示

前端已支持网格策略结构化消息卡片，当前可展示三类核心信息：

| 卡片类型 | 展示内容 |
| --- | --- |
| 创建卡片 | 策略参数、预算、杠杆、区间、网格数、执行模式 |
| 收益卡片 | 当前状态、累计收益、收益率、运行时长、仓位与风控指标 |
| AI解释/日志卡片 | 市场分析、为什么这么设参、最近决策与运行日志 |

同时兼容 `/api/chat-ai/intent` 与 `/api/chat/intent` 路径，前端无需额外切换接口。

## 五、验证结果

### 1. 编排链路回归验证

已执行：

```bash
pnpm exec tsx scripts/test-grid-strategy-orchestrator.ts
```

验证结果：

| 场景 | 结果 |
| --- | --- |
| 创建智能网格建议 | 通过 |
| 查询策略状态卡片 | 通过 |
| 停止策略回退逻辑 | 通过 |
| 动态调参入口 | 已接通；未配置 `OKX_GRID_TEST_ALGO_ID` 时自动跳过真实测试 |

### 2. TypeScript 校验说明

执行：

```bash
pnpm exec tsc --noEmit
```

当前剩余报错与本次改动无关，来自仓库既有依赖缺失：

| 文件 | 问题 |
| --- | --- |
| `server/_core/context.ts` | 缺少 `../../drizzle/schema` |
| `server/_core/sdk.ts` | 缺少 `../../drizzle/schema` |
| `server/db.ts` | 缺少 `../drizzle/schema` |
| `shared/types.ts` | 缺少 `../drizzle/schema` |

这属于仓库级历史问题，不是本批智能网格模块引入的新错误。

## 六、环境变量建议

建议至少配置以下变量后再做灰度实盘联调：

| 变量名 | 用途 |
| --- | --- |
| `OKX_API_KEY` | OKX 实盘 API Key |
| `OKX_API_SECRET` | OKX 实盘 API Secret |
| `OKX_API_PASSPHRASE` | OKX 实盘 API Passphrase |
| `OKX_GRID_LIVE_TRADING_ENABLED` | 是否允许真实创建/改参 |
| `OKX_GRID_ALLOW_EMERGENCY_STOP` | 是否允许真实停策略 |
| `OKX_GRID_ALLOWED_INST_IDS` | 允许实盘的合约列表 |
| `OKX_GRID_MAX_BUDGET_USDT` | 单策略预算上限 |
| `OKX_GRID_MONITOR_INTERVAL_MS` | 监控轮询周期 |
| `OKX_GRID_REBALANCE_INTERVAL_MS` | 自动调参周期 |
| `OKX_GRID_MAX_DRAWDOWN_RATIO` | 最大回撤熔断线 |
| `OKX_GRID_ABNORMAL_FUNDING_RATE_THRESHOLD` | 异常资金费率阈值 |

## 七、下一步建议

下一批建议优先推进以下三项：

| 优先级 | 建议事项 |
| --- | --- |
| P0 | 接入真实 OKX 子账户灰度联调，完成创建/改参/停策略闭环验收 |
| P0 | 增加策略列表页与监控面板，让多策略并行运行更可观测 |
| P1 | 把运行日志与熔断通知接入正式消息通道（站内信 / webhook / 推送） |
