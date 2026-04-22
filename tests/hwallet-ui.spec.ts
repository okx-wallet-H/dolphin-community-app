import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("H Wallet 结构化业务入口校验", () => {
  it("智能对话页应接入自然语言解析、快速交易识别与真实链上执行链路", () => {
    const chatScreen = readProjectFile("app/(tabs)/chat.tsx");

    expect(chatScreen).toContain("parseChatAiIntent");
    expect(chatScreen).toContain("parseQuickSwapIntent");
    expect(chatScreen).toContain("previewOnchainSwap");
    expect(chatScreen).toContain("executeOnchainSwap");
    expect(chatScreen).toContain("先恢复 Agent Wallet");
    expect(chatScreen).toContain('router.push("/(tabs)/wallet")');
    expect(chatScreen).toContain('router.push("/earn")');
  });

  it("赚币页应只展示在线策略生成链路与真实空态，不再回退本地演示模板", () => {
    const earnScreen = readProjectFile("app/earn.tsx");

    expect(earnScreen).toContain("parseChatAiIntent");
    expect(earnScreen).toContain("normalizeEarnPlan");
    expect(earnScreen).toContain("AI 智能赚币");
    expect(earnScreen).toContain("当前仅展示实时生成的在线赚币策略");
    expect(earnScreen).toContain("重新生成策略");
    expect(earnScreen).not.toContain("专业演示方案");
  });

  it("应用配置应使用 H Wallet 品牌名称并完成 logoUrl 配置", () => {
    const appConfig = readProjectFile("app.config.ts");

    expect(appConfig).toContain('appName: "H Wallet"');
    expect(appConfig).toContain('logoUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663458603911/AQ7DNFW2AtZXchZVZkUYdL/h-wallet-icon-UTsNtRdFQEnoWpyzgewLzd.png"');
    expect(appConfig).not.toContain("{{project_title}}");
    expect(appConfig).toContain('icon: "./assets/images/icon.png"');
  });

  it("底部导航应包含钱包、市场、对话、赚币、我的五个主入口", () => {
    const tabLayout = readProjectFile("app/(tabs)/_layout.tsx");

    expect(tabLayout).toContain('name="index"');
    expect(tabLayout).toContain('name="market"');
    expect(tabLayout).toContain('name="chat"');
    expect(tabLayout).toContain('name="earn"');
    expect(tabLayout).toContain('name="profile"');
    expect(tabLayout).toContain('title: "钱包"');
    expect(tabLayout).toContain('title: "行情"');
    expect(tabLayout).toContain('title: "对话"');
    expect(tabLayout).toContain('title: "赚币"');
    expect(tabLayout).toContain('title: "我的"');
  });

  it("tabs 默认首页应跳转到对话页，而钱包页本身包含真实资产查询与钱包恢复结构", () => {
    const indexScreen = readProjectFile("app/(tabs)/index.tsx");
    const walletScreen = readProjectFile("app/(tabs)/wallet.tsx");

    expect(indexScreen).toContain("Redirect");
    expect(indexScreen).toContain("/(tabs)/chat");
    expect(walletScreen).toContain("getAccountAssets");
    expect(walletScreen).toContain("getMe()");
    expect(walletScreen).toContain("WALLET_STORAGE_KEY");
    expect(walletScreen).toContain("Clipboard.setStringAsync");
    expect(walletScreen).toContain("DonutChart");
  });
});
