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
    expect(loginScreen).toContain("router.replace('/(tabs)/chat')");
    expect(loginScreen).toContain("发送验证码");
    expect(loginScreen).toContain("继续进入");
    expect(loginScreen).toContain("正在恢复登录状态");
  });

  it("钱包页应复用真实资产查询、缓存钱包快照，并提供充值地址与会话恢复能力", () => {
    const walletScreen = readProjectFile("app/(tabs)/wallet.tsx");

    expect(walletScreen).toContain("getAccountAssets");
    expect(walletScreen).toContain("WALLET_STORAGE_KEY");
    expect(walletScreen).toContain("getMe()");
    expect(walletScreen).toContain("Clipboard.setStringAsync");
    expect(walletScreen).toContain("充值地址");
    expect(walletScreen).toContain('router.push("/(tabs)/chat")');
  });

  it("聊天页应复用 AI 意图解析能力，并支持一句话交易快路径与真实执行状态提示", () => {
    const chatScreen = readProjectFile("app/(tabs)/chat.tsx");

    expect(chatScreen).toContain("parseChatAiIntent");
    expect(chatScreen).toContain("parseQuickSwapIntent");
    expect(chatScreen).toContain("previewOnchainSwap");
    expect(chatScreen).toContain("executeOnchainSwap");
    expect(chatScreen).toContain("你好，我是 H Wallet AI 助手");
    expect(chatScreen).toContain("先恢复 Agent Wallet");
    expect(chatScreen).toContain("交易工作流已启动");
    expect(chatScreen).toContain('router.push("/(tabs)/wallet")');
  });

  it("策略中心页应复用自动策略、信号追踪与链上任务回流数据，而不是静态占位页", () => {
    const communityScreen = readProjectFile("app/(tabs)/community.tsx");

    expect(communityScreen).toContain("AGENT_PLAN_STORAGE_KEY");
    expect(communityScreen).toContain("loadSyncedPlan");
    expect(communityScreen).toContain("AI 策略中心");
    expect(communityScreen).toContain("自动执行时间线");
    expect(communityScreen).toContain("flashMessage");
  });

  it("赚币页应展示在线策略生成、收益指标与空态降级反馈，而不是本地演示模板", () => {
    const earnScreen = readProjectFile("app/earn.tsx");

    expect(earnScreen).toContain("parseChatAiIntent");
    expect(earnScreen).toContain("normalizeEarnPlan");
    expect(earnScreen).toContain("AI 智能赚币");
    expect(earnScreen).toContain("预估年化");
    expect(earnScreen).toContain("重新生成策略");
    expect(earnScreen).not.toContain("专业演示方案");
  });

  it("我的页应保留账户总览与安全、通知、偏好、钱包管理等业务入口，并去除伪统计数字", () => {
    const profileScreen = readProjectFile("app/(tabs)/profile.tsx");

    expect(profileScreen).toContain("H Wallet 用户");
    expect(profileScreen).toContain("安全中心");
    expect(profileScreen).toContain("通知设置");
    expect(profileScreen).toContain("钱包管理");
    expect(profileScreen).not.toContain(">126<");
    expect(profileScreen).not.toContain(">8<");
    expect(profileScreen).not.toContain(">3<");
  });
});
