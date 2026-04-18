# Agent Wallet 验证异常记录

## 本轮验证码实测输入

| 项目 | 值 |
| --- | --- |
| 邮箱 | `haitun858588@gmail.com` |
| 验证码 | 已由用户提供并用于线上验证 |
| 校验接口 | `POST https://h-wallet-api-v2.vercel.app/api/agent-wallet/verify` |

## 实际 HTTP 结果

| 项目 | 结果 |
| --- | --- |
| HTTP 状态码 | `200` |
| `set-cookie` | 返回了 `app_session_id` |
| 返回体特征 | 仍为旧结构，并未返回新的 OKX Agent Wallet 完整字段 |

## 实际返回体摘录

```json
{
  "ok": true,
  "success": true,
  "app_session_id": "...",
  "user": {
    "openId": "wallet:haitun858588@gmail.com",
    "name": "haitun858588",
    "email": "haitun858588@gmail.com",
    "loginMethod": "email"
  },
  "wallet": {
    "address": "0x860935c62f2d06c4c8a07d9f95671d9d06936f78",
    "chain": "EVM"
  }
}
```

## 为什么这说明当前线上仍可能命中旧逻辑

当前返回中没有我这轮修复后应出现的 `wallet.evmAddress`、`wallet.solanaAddress`、`isNewWallet`、`sessionUser/openId` 映射结果，也没有真实 OKX Agent Wallet 校验后期望的完整地址结构。这说明虽然验证码发送链路已经打通，但 **验证码校验入口很可能仍然被旧逻辑、旧部署产物或旧路由覆盖**。

## 当前结论

在彻底确认生产环境真实命中的验证入口之前，**不应指导用户向当前返回地址转入测试 USDT**，以免把资产打到错误的钱包体系。
