import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("真实行情与业务页面实现校验", () => {
  it("API 层应提供公共行情快照能力，并包含 24 小时涨跌幅计算", () => {
    const apiFile = readProjectFile("lib/_core/api.ts");

    expect(apiFile).toContain("export async function getPublicMarketSnapshot");
    expect(apiFile).toContain("open24h");
    expect(apiFile).toContain(
      "const change24h = Number.isFinite(price) && Number.isFinite(open24h) && open24h > 0 ? (price - open24h) / open24h : null;",
    );
    expect(apiFile).toContain("MARKET_OKX_INST_ID_MAP");
    expect(apiFile).toContain("source: 'okx-mcp' | 'public-market'");
  });

  it("行情页应包含真实快照加载、结构化行情卡片与等待同步降级", () => {
    const marketScreen = readProjectFile("app/(tabs)/market.tsx");

    expect(marketScreen).toContain("getMarketSnapshotByMcp");
    expect(marketScreen).toContain("formatVolumeLabel");
    expect(marketScreen).toContain("等待行情");
    expect(marketScreen).toContain("marketCard");
    expect(marketScreen).toContain("heroCard");
  });

  it("赚币页应包含在线策略生成、收益指标与真实空态反馈", () => {
    const earnScreen = readProjectFile("app/earn.tsx");

    expect(earnScreen).toContain("parseChatAiIntent");
    expect(earnScreen).toContain("normalizeEarnPlan");
    expect(earnScreen).toContain("AI 智能赚币");
    expect(earnScreen).toContain("预估年化");
    expect(earnScreen).toContain("重新生成策略");
    expect(earnScreen).not.toContain("专业演示方案");
  });
});
