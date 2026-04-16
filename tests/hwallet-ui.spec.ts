import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("H Wallet 结构化业务入口校验", () => {
  it("智能对话页应接入价格查询、兑换报价执行与转账回执闭环", () => {
    const chatScreen = readProjectFile("app/(tabs)/chat.tsx");

    expect(chatScreen).toContain("parseChatAiIntent");
    expect(chatScreen).toContain("parseDexSwapIntent");
    expect(chatScreen).toContain("getDexSwapQuote");
    expect(chatScreen).toContain("executeDexSwap");
    expect(chatScreen).toContain("detectTransferIntent");
    expect(chatScreen).toContain("兑换执行回执");
    expect(chatScreen).toContain("转账执行回执");
    expect(chatScreen).toContain('router.push("/(tabs)/wallet")');
    expect(chatScreen).toContain('router.push("/(tabs)/earn")');
  });

  it("赚币页应支持策略选择后调用 AI 意图链路并展示执行反馈", () => {
    const earnScreen = readProjectFile("app/(tabs)/earn.tsx");

    expect(earnScreen).toContain("parseChatAiIntent");
    expect(earnScreen).toContain("handleActivateStrategy");
    expect(earnScreen).toContain("ExecutionFeedback");
    expect(earnScreen).toContain("专业演示方案");
    expect(earnScreen).toContain("自动赚币已开启");
    expect(earnScreen).toContain("自动任务卡片");
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

  it("tabs 默认首页应跳转到钱包页，而钱包页本身包含资产查询与跨页面联动结构", () => {
    const indexScreen = readProjectFile("app/(tabs)/index.tsx");
    const walletScreen = readProjectFile("app/(tabs)/wallet.tsx");

    expect(indexScreen).toContain("Redirect");
    expect(indexScreen).toContain("/(tabs)/wallet");
    expect(walletScreen).toContain("getAccountAssets");
    expect(walletScreen).toContain('router.push("/(tabs)/chat")');
    expect(walletScreen).toContain('router.push("/(tabs)/earn")');
    expect(walletScreen).toContain("自动任务卡片");
  });
});
