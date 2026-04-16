import { OkxGridBotService } from "../src/services/okx";

const service = new OkxGridBotService();

async function main() {
  const aiParams = await service.getAiParam({
    algoOrdType: "contract_grid",
    instId: "BTC-USDT-SWAP",
    direction: "neutral",
  });

  if (aiParams.length === 0) {
    throw new Error("AI 参数接口未返回数据");
  }

  const baseline = aiParams[0];
  console.log("[ai-param]", JSON.stringify(baseline));

  const quantity = await service.getGridQuantity({
    algoOrdType: "contract_grid",
    instId: baseline.instId,
    maxPx: String(baseline.maxPx),
    minPx: String(baseline.minPx),
    runType: baseline.runType,
    lever: String(baseline.lever || 1),
  });

  if (quantity.length === 0) {
    throw new Error("最大网格数接口未返回数据");
  }
  console.log("[grid-quantity]", JSON.stringify(quantity[0]));

  const minInvestment = await service.getMinInvestment({
    algoOrdType: "contract_grid",
    instId: baseline.instId,
    maxPx: String(baseline.maxPx),
    minPx: String(baseline.minPx),
    gridNum: String(Math.min(baseline.gridNum, quantity[0]?.maxGridNum ?? baseline.gridNum)),
    runType: baseline.runType,
    lever: String(baseline.lever || 1),
    direction: baseline.direction,
  });

  if (minInvestment.length === 0) {
    throw new Error("最小投入接口未返回数据");
  }
  console.log("[min-investment]", JSON.stringify(minInvestment[0]));

  console.log("Grid Bot 公共能力烟雾测试通过");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
