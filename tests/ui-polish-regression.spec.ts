import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("H Wallet 业务联动回归保护", () => {
  it("tabs 默认入口应重定向到当前对话首页", () => {
    const source = readProjectFile("app/(tabs)/index.tsx");

    expect(source).toContain("Redirect");
    expect(source).toContain("/(tabs)/chat");
  });

  it("AI 对话页应保留自然语言意图解析、快速交易链路与钱包状态提示", () => {
    const source = readProjectFile("app/(tabs)/chat.tsx");

    expect(source).toContain("parseChatAiIntent");
    expect(source).toContain("parseQuickSwapIntent");
    expect(source).toContain("previewOnchainSwap");
    expect(source).toContain("executeOnchainSwap");
    expect(source).toContain("你好，我是 H Wallet AI 助手");
    expect(source).toContain("先恢复 Agent Wallet");
    expect(source).toContain("交易工作流已启动");
  });

  it("我的页面应保留用户总览和安全、通知、偏好、钱包管理等设置入口，并移除硬编码统计", () => {
    const source = readProjectFile("app/(tabs)/profile.tsx");

    expect(source).toContain("H Wallet 用户");
    expect(source).toContain("安全中心");
    expect(source).toContain("通知设置");
    expect(source).toContain("钱包管理");
    expect(source).not.toContain(">126<");
    expect(source).not.toContain(">8<");
    expect(source).not.toContain(">3<");
  });
});
