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
  });

  it("行情页应包含紫色主视觉、红绿涨跌标签与结构化行情卡片", () => {
    const marketScreen = readProjectFile("app/(tabs)/market.tsx");

    expect(marketScreen).toContain("getPublicMarketSnapshot");
    expect(marketScreen).toContain("主流资产");
    expect(marketScreen).toContain("changePillUp");
    expect(marketScreen).toContain("changePillDown");
    expect(marketScreen).toContain("heroCard");
    expect(marketScreen).toContain("marketCard");
  });

  it("赚币页应包含策略选择、APR 展示与自动赚币执行反馈", () => {
    const earnScreen = readProjectFile("app/(tabs)/earn.tsx");

    expect(earnScreen).toContain("ETH 稳健网格策略");
    expect(earnScreen).toContain("选择策略并开启自动赚币");
    expect(earnScreen).toContain("策略池平均 APR");
    expect(earnScreen).toContain("handleActivateStrategy");
    expect(earnScreen).toContain("ExecutionFeedback");
    expect(earnScreen).toContain("自动赚币已开启");
  });
});
