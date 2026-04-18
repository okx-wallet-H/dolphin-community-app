# Agent Wallet 旧邮箱注册接入清理说明

**作者：Manus AI**  
**日期：2026-04-18**

本次已按你的要求，把**之前不正确的邮箱注册接入**从当前主链路中清理掉，并统一保留为**这次已经验证通过的真实 OKX Agent Wallet 链路**。

## 已完成的清理

| 范围 | 处理结果 |
|---|---|
| 登录页入口 | 已移除“登录/注册”双态切换，只保留单一路径的邮箱验证码验证入口 |
| 登录页文案 | 已明确标注“旧的邮箱注册接入已停用” |
| 前端验证码发送接口 | 已统一从 `/api/agent-wallet/send-otp` 切换为 `/api/agent-wallet/send-code` |
| Express 路由 | 已删除 `/api/auth/send-code`、`/api/auth/verify`、Agent Wallet 对 `/api/auth/me` 与 `/api/auth/logout` 的重复别名暴露 |
| Serverless 旧别名 | `api/auth/send-code.ts` 与 `api/auth/verify.ts` 已改为显式返回停用提示，防止外部继续误用 |
| 类型检查 | `pnpm check` 已恢复通过 |

## 当前保留的正确链路

| 用途 | 保留路径 |
|---|---|
| 发送验证码 | `/api/agent-wallet/send-code` |
| 校验验证码 | `/api/agent-wallet/verify` |
| 获取 Agent Wallet 当前用户 | `/api/agent-wallet/me` |
| 退出 Agent Wallet 会话 | `/api/agent-wallet/logout` |

## 当前状态

现在主链路已经明确收口为：

> **邮箱 -> 验证码 -> 当前已验证通过的真实 OKX Agent Wallet -> 钱包首页**

旧的邮箱注册别名入口不会再作为正常接入链路继续使用。

## 仍需注意

虽然旧接入已经在代码层清掉，但如果线上仍有旧部署或旧域名缓存，外部访问结果仍可能受历史部署影响。因此后续联调和测试时，仍应优先使用当前已经验证通过的新链路域名与返回的钱包地址。
