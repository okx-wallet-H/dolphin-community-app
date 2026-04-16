import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("H Wallet 业务打通回归校验", () => {
  it("登录页应保留邮箱验证码登录、会话恢复与登录后跳转到对话页的链路", () => {
    const loginScreen = readProjectFile("app/index.tsx");

    expect(loginScreen).toContain("sendAgentWalletOtp");
    expect(loginScreen).toContain("verifyAgentWalletOtp");
    expect(loginScreen).toContain('router.replace("/(tabs)/chat")');
    expect(loginScreen).toContain("获取验证码");
    expect(loginScreen).toContain("立即登录");
    expect(loginScreen).toContain("正在恢复登录状态");
  });

  it("钱包页应复用真实资产查询、缓存钱包快照，并提供对话、赚币与自动任务联动入口", () => {
    const walletScreen = readProjectFile("app/(tabs)/wallet.tsx");

    expect(walletScreen).toContain("getAccountAssets");
    expect(walletScreen).toContain("WALLET_STORAGE_KEY");
    expect(walletScreen).toContain("自动任务卡片");
    expect(walletScreen).toContain('router.push("/(tabs)/chat")');
    expect(walletScreen).toContain('router.push("/(tabs)/earn")');
    expect(walletScreen).toContain('router.push("/(tabs)/community")');
  });

  it("聊天页应复用 AI 意图解析能力，并支持赚币方案、兑换执行与钱包导航等结构化返回", () => {
    const chatScreen = readProjectFile("app/(tabs)/chat.tsx");

    expect(chatScreen).toContain("parseChatAiIntent");
    expect(chatScreen).toContain("parseDexSwapIntent");
    expect(chatScreen).toContain("getDexSwapQuote");
    expect(chatScreen).toContain("executeDexSwap");
    expect(chatScreen).toContain("H Wallet 智能助手");
    expect(chatScreen).toContain("response.earnPlan");
    expect(chatScreen).toContain("walletHint");
    expect(chatScreen).toContain("转账执行回执");
    expect(chatScreen).toContain("兑换执行回执");
    expect(chatScreen).toContain('router.push("/(tabs)/wallet")');
  });

  it("自动任务页应复用自动任务与赚币策略同步数据，而不是静态占位页", () => {
    const communityScreen = readProjectFile("app/(tabs)/community.tsx");

    expect(communityScreen).toContain("AGENT_PLAN_STORAGE_KEY");
    expect(communityScreen).toContain("loadSyncedPlan");
    expect(communityScreen).toContain("自动任务卡片");
    expect(communityScreen).toContain("稳定币收益巡航");
    expect(communityScreen).toContain("flashMessage");
  });

  it("赚币页应展示策略选择、APR 信息与自动赚币执行反馈", () => {
    const earnScreen = readProjectFile("app/(tabs)/earn.tsx");

    expect(earnScreen).toContain("ETH 稳健网格策略");
    expect(earnScreen).toContain("选择策略并开启自动赚币");
    expect(earnScreen).toContain("策略池平均 APR");
    expect(earnScreen).toContain("handleActivateStrategy");
    expect(earnScreen).toContain("ExecutionFeedback");
    expect(earnScreen).toContain("自动赚币已开启");
  });

  it("我的页应保留账户总览与安全、通知、偏好、钱包管理等业务入口", () => {
    const profileScreen = readProjectFile("app/(tabs)/profile.tsx");

    expect(profileScreen).toContain("H Wallet 用户");
    expect(profileScreen).toContain("账户安全等级：高");
    expect(profileScreen).toContain("安全中心");
    expect(profileScreen).toContain("通知设置");
    expect(profileScreen).toContain("钱包管理");
  });
});
