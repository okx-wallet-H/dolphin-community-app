# H Wallet 项目 TODO

## 项目概述

H Wallet 是一个链上 AI 钱包 App，用户通过邮箱创建 Agent Wallet，支持链上 Swap、DeFi 与 AI 智能赚币。当前技术栈为 **React Native + Expo**，后端部署在 **Vercel**。

## 已完成事项

- [x] App 基础框架搭建（React Native + Expo）
- [x] UI 设计定稿（紫色白底、Glassmorphism 质感）
- [x] 底部 5 个 Tab 页面：钱包、行情、对话、赚币、我的
- [x] 邮箱 OTP 登录功能（前后端已通）
- [x] AI 对话功能（对接真实 AI 接口，已通）
- [x] 行情页面（对接 OKX 公开行情 API，BTC/ETH/SOL 实时价格已通）
- [x] Expo 构建配置（preview profile，产出 APK）
- [x] GitHub 自动构建配置（push 到 main 自动触发 APK 构建）
- [x] APK 构建成功，可下载安装测试
- [x] 代码安全问题修复（6 个安全漏洞已修复）
- [x] X 平台官方账号用户名选定
- [x] ui-rebuild-v2 分支合并到 main
- [x] 接入 **onchainos-skills MCP 服务**（一次性对接，接入后钱包、行情、Swap、DeFi、聪明钱、Meme扫描等全部能力可用）
- [x] 各页面对接真实数据展示（钱包、行情、对话、赚币、Swap、聪明钱、Meme扫描）
- [x] EAS Workflow 修复（触发分支从 ui-rebuild-v2 改为 main）
- [x] Vercel 后端部署修复（统一 Express 入口，解决双部署模型冲突，API 全部跑通）
- [x] App 设计系统规范文档（design.md 更新，参考 Rainbow Wallet、Uniswap Mobile 等）
- [x] 后端关键接口线上验证通过（/api/okx/mcp token_price_info、portfolio_all_balances、defi_search 均返回真实数据）

## 未完成事项

### 一、Web3 功能落地（当前进行中）

将 OKX OnchainOS 13 个链上 Skill 整合为 App 内可用的对话式产品能力：

- [x] AI 对话调用链上能力（用户提问 → AI 调真实数据 → 回复带可操作卡片）
- [x] 代币搜索/价格查询（搜代币、查价格、看涨跌）
- [x] 链上余额/资产展示（真实钱包余额，去掉演示数据兜底）
- [ ] DeFi 产品搜索/申购（已完成真实 DeFi 搜索与 APY 展示，申购按钮暂显示“即将上线”）
- [x] Swap 交易（链上代币兑换，对话页已补 Swap 确认卡片）
- [x] Onchain 交易状态机统一（已统一为 `preview / awaiting_confirmation / executing / success / failed`）
- [x] Onchain 交易任务持久化骨架（已新增 `server/_core/onchain-tx-store.ts`）
- [x] Onchain 回执轮询增强（已升级为 4 次、每次 2 秒的受控轮询）
- [x] Onchain 执行风控规则（已补金额上限、白名单链、异常滑点拦截）
- [x] Onchain 幂等与防重复提交（已补 idempotency key 与 2 分钟时间窗口校验）
- [x] Serverless Onchain 路由生产化对齐（已同步持久化、风控与幂等逻辑）
- [ ] Builder Code 注入真实 X Layer 发送层（已完成 `EXPO_PUBLIC_XLAYER_BUILDER_CODE` 配置与确认页透传骨架，待外部确认页或钱包客户端接入真实 `sendTransaction/dataSuffix` 落点）
- [x] 聪明钱追踪（大户动向）
- [x] Meme 代币扫描（热门 Meme 币发现）

### 二、两大核心产品线

- [x] 完成 **AI 智能赚币** 产品线建设（链上 Web3，整合 Agent Wallet 链上技能）
- [x] 完成 **Agent 策略大师** 产品线建设（对接 OKX Agent Trade Kit）

### 三、UI 优化（功能跑通后统一打磨）

- [x] 按 design.md 设计规范统一重做 UI（紫色主题、Glassmorphism、卡片质感）
- [x] 登录页改为纯验证码登录（去掉密码）
- [x] 对话页作为默认首页，去掉顶部钱包入口和我的按钮
- [x] 钱包页右上角改为返回键
- [x] 社区页顶部改为搜索框（搜代币、合约、地址）

## 通用开发约定

- [x] 所有新文件均使用 LF 换行符与 UTF-8 编码
- [x] 提交信息格式统一为 `feat/fix/docs/chore: 简短描述`（Conventional Commits）
- [x] 每个 PR 只对应一个主题，避免混合多种重构
- [x] 所有文档、注释、UI 文案全部使用中文
