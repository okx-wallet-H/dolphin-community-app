# Agent Wallet 正确仓库修复与部署状态说明

## 本次确认的正确范围

本轮后续操作已严格收敛到 **`okx-wallet-H/dolphin-community-app`** 仓库，本地目录为 `/home/ubuntu/dolphin-community-app-ci-build`。

当前主分支最新提交包括两部分关键修复：

| 项目 | 结果 |
| --- | --- |
| 真实 OKX Agent Wallet 主链路修复 | 已存在于 `74a4920` `fix: enforce real okx agent wallet flow` |
| Vercel Express 部署配置修复 | 已提交并推送为 `3f118d5` `fix: restore zero-config vercel express deployment` |

## 本次已完成的关键动作

我已经确认，`dolphin-community-app` 仓库中的 Agent Wallet 逻辑当前是“**只接受真实 OKX Agent Wallet 返回结果**”的版本。服务端 `server/_core/agent-wallet.ts` 会在缺少 OKX 凭证时直接报错，不再静默回退为伪钱包；前端登录页 `app/index.tsx` 也会在 `mockMode` 或缺少完整地址时主动阻止登录成功状态。

随后，我修复了该仓库的 `vercel.json`。旧配置会把项目引向自定义 build 产物和过时 rewrite 规则，导致 Vercel 无法正确识别 Express 入口，且还会覆盖真实 API 路由。修复后改为 Vercel 官方推荐的 **Express 零配置入口模式**，使 `server.ts` 作为默认导出入口被正确识别。

## 部署与验证结果

| 检查项 | 结果 |
| --- | --- |
| 本地 `vercel build --prod` | 成功，已生成 `.vercel/output` |
| 生产预构建部署 | 成功 |
| 生产别名 | `https://new-h-wallet-api.vercel.app` |
| Agent Wallet 发送验证码接口 | 已命中真实链路，但当前返回 503 |
| 503 原因 | 线上环境中**尚未注入 OKX Agent Wallet 必需凭证** |

本次线上接口验证返回如下语义结果：生产环境已经不再返回 mock 钱包，也不再假装创建成功，而是明确提示缺少以下变量：

| 缺少变量组 | 说明 |
| --- | --- |
| `OKX_AGENT_WALLET_API_KEY` 或 `OKX_API_KEY` | 必填 |
| `OKX_AGENT_WALLET_SECRET_KEY` 或 `OKX_SECRET_KEY` | 必填 |
| `OKX_AGENT_WALLET_PASSPHRASE` 或 `OKX_PASSPHRASE` | 必填 |

## 你现在需要怎么配合

当前代码、仓库和部署入口已经就位，下一步不再是修代码，而是**把 OKX Agent Wallet 的真实运行密钥注入到当前 Vercel 项目环境变量**。

建议你现在在当前 Vercel 项目中补齐上述三组变量。补齐以后，我就可以立刻再次调用：

1. `/api/agent-wallet/send-code` 发送真实验证码；
2. 你把邮箱收到的验证码发给我；
3. 我继续调用 `/api/agent-wallet/verify` 完成真实钱包创建 / 恢复；
4. 再由你转入测试 USDT 做入账实测。

## 当前结论

> 现在不是代码还没修好，而是**线上项目已经部署到正确仓库版本，但运行环境还缺少 OKX Agent Wallet 密钥**。一旦你把 Vercel 项目的环境变量补齐，我就可以继续做真实验证码和测试 USDT 实测。
