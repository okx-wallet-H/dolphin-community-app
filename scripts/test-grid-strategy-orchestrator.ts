import { analyzeAndTuneGridStrategy } from "../src/services/grid";
import {
  createSmartGridStrategy,
  getSmartGridStatus,
  parseGridIntent,
  stopSmartGridStrategy,
} from "../server/_core/grid-strategy";

async function main() {
  const createMessage = "帮我用1000U跑BTC网格";
  const statusMessage = "策略怎么样了";
  const stopMessage = "停掉策略";

  console.log("[parse:create]", parseGridIntent(createMessage));
  console.log("[parse:status]", parseGridIntent(statusMessage));
  console.log("[parse:stop]", parseGridIntent(stopMessage));

  const createResult = await createSmartGridStrategy(createMessage);
  console.log("[create]", JSON.stringify(createResult, null, 2));

  const statusResult = await getSmartGridStatus(statusMessage);
  console.log("[status]", JSON.stringify(statusResult, null, 2));

  const stopResult = await stopSmartGridStrategy(stopMessage);
  console.log("[stop]", JSON.stringify(stopResult, null, 2));

  if (process.env.OKX_GRID_TEST_ALGO_ID) {
    const tuningResult = await analyzeAndTuneGridStrategy({
      algoId: process.env.OKX_GRID_TEST_ALGO_ID,
      instId: process.env.OKX_GRID_TEST_INST_ID || "BTC-USDT-SWAP",
      accountBudget: Number(process.env.OKX_GRID_TEST_BUDGET || 1000),
      riskLevel: "均衡",
      direction: "neutral",
    });
    console.log("[tuning]", JSON.stringify(tuningResult, null, 2));
  } else {
    console.log("[tuning] 跳过：未设置 OKX_GRID_TEST_ALGO_ID");
  }
}

main().catch((error) => {
  console.error("[grid-strategy-test] failed", error);
  process.exitCode = 1;
});
