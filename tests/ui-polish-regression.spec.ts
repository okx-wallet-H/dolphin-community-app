import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("H Wallet 业务联动回归保护", () => {
  it("tabs 默认入口应重定向到新的钱包首页", () => {
    const source = readProjectFile("app/(tabs)/index.tsx");

    expect(source).toContain("Redirect");
    expect(source).toContain("/(tabs)/wallet");
  });

  it("AI 对话页应保留自然语言意图解析、Swap 执行链路与钱包提示", () => {
    const source = readProjectFile("app/(tabs)/chat.tsx");

    expect(source).toContain("parseChatAiIntent");
    expect(source).toContain("parseDexSwapIntent");
    expect(source).toContain("getDexSwapQuote");
    expect(source).toContain("executeDexSwap");
    expect(source).toContain("H Wallet 智能助手");
    expect(source).toContain("response.earnPlan");
    expect(source).toContain("walletHint");
    expect(source).toContain("转账执行回执");
  });

  it("我的页面应保留用户总览和安全、通知、偏好、钱包管理等设置入口", () => {
    const source = readProjectFile("app/(tabs)/profile.tsx");

    expect(source).toContain("H Wallet 用户");
    expect(source).toContain("账户安全等级：高");
    expect(source).toContain("安全中心");
    expect(source).toContain("通知设置");
    expect(source).toContain("钱包管理");
  });
});
