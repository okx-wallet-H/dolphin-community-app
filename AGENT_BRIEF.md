# 🚨 上岗必读 AGENT BRIEF
> **你是 H Wallet 的开发助手。上岗前必须读完这个文件，不读不准开始任何操作！**
> 最后更新：2026-04-05

---

## 项目基本信息

- **项目名**：H Wallet App（React Native + Expo）
- **GitHub**：okx-wallet-H/new-h-wallet
- **代码路径**：/home/ubuntu/new-h-wallet（你的沙盒）
- **Expo 项目 ID**：076111c0-68cf-4155-9427-9526b03dd9b7
- **Expo slug**：h-wallet

---

## 设计规范（违反即返工）

| 项目 | 正确值 | 错误示例 |
|------|--------|---------|
| 背景色 | **#FFFFFF（白色）** | ❌ #0B0714、#1a1a2e 等深黑色 |
| 主色 | **#7C3AED（紫色）** | ❌ 其他颜色 |
| 文字主色 | **#1A1A2E** | ❌ 白色文字 |
| 主题文件 | **constants/manus-ui.ts（ManusColors）** | ❌ 自己写颜色值 |

---

## 路由结构（改错文件等于白做）

```
app/
├── _layout.tsx          # 根布局
├── login.tsx            # 登录页
├── settings.tsx         # 设置页
└── (tabs)/
    ├── _layout.tsx      # Tab 布局
    ├── chat.tsx         ← 对话页（改这个！）
    ├── wallet.tsx       ← 钱包页
    └── community.tsx    ← 社区页

screens/                 ← ⚠️ 废弃目录，绝对不要改！
```

---

## 开发原则

1. **我们是对接 API，不是自己开发功能**
   - OKX Onchain OS / DEX / DeFi 等能力全部通过调用官方 API 实现
   - 不要自己造轮子，不要用 mock 数据替代真实 API
   - 遇到 API 文档不清楚，先查文档，再问，不要自行假设

2. **当前阶段只做链上（Onchain OS），不做 CEX**
   - CEX 现货/合约/网格交易是后期开发，现阶段不接

3. **每次改完必须推到 GitHub**
   ```bash
   git add .
   git commit -m "描述"
   git push origin main
   ```

---

## 手续费配置（核心商业模式，每次 Swap 必须带！）

```javascript
// EVM 链
feePercent: 1.5
fromTokenReferrerWalletAddress: "0x29018d7e0dd00de315dd131fbe342817674430bd"

// Solana
feePercent: 3
fromTokenReferrerWalletAddress: "0x29018d7e0dd00de315dd131fbe342817674430bd"
```

---

## OKX API Key（Onchain OS）

```
API Key：39b84d18-8693-4554-9a37-170cbc7a5812
Secret Key：A07D90C0C2A85CE957A1619D8DA38E20
Passphrase：yy133678.
```

---

## Expo 发布规范

```bash
# 1. 清缓存
rm -rf .expo && rm -rf node_modules/.cache

# 2. 发布
eas update --branch main --message "你的描述"

# 3. 每次发布后在页面加版本号标识（如 v2.2），方便确认是否更新
```

---

## 已完成功能（不要重复做）

| 功能 | commit | 文件 |
|------|--------|------|
| 登录页 UI | d353c0c | app/login.tsx |
| 钱包页 UI + 链上余额 | ce7df3a | app/(tabs)/wallet.tsx |
| 社区页 UI | 5566cb7 | app/(tabs)/community.tsx |
| 设置页功能 | dd88d7e | app/settings.tsx |
| OKX 行情 API | 8a09267 | services/okxMarket.ts |
| OKX DEX Swap API | da6a5c1 | services/okxSwap.ts |
| Chat AI 执行链路 | d3db260 | app/(tabs)/chat.tsx |
| Agent Wallet 登录/验证/余额 | e3b5763 | server/routes/wallet.ts |
| EAS Build 配置 | ab2fed7 | eas.json |
| Expo slug 改为 h-wallet | 8e83836 | app.json |
| Chat 页加 v2.1 版本标识 | 68ab1cf | app/(tabs)/chat.tsx |

---

## 任务完成后必须汇报

1. 改了哪些文件
2. commit hash 是多少
3. 有没有遇到问题
4. 下一步建议
