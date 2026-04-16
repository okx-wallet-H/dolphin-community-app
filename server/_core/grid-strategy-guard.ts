import { ENV } from "./env";
import { canSendGridMutation, hasOkxPrivateCredentials } from "./grid-runtime-config";
import { monitorActiveGridStrategies } from "./grid-strategy-monitor";
import {
  appendGridStrategyLog,
  listActiveGridStrategies,
  markGridStrategyDecision,
  updateGridStrategy,
} from "./grid-strategy-store";
import { analyzeAndTuneGridStrategy, applyDynamicGridDecision } from "../../src/services/grid";

let monitorTimer: ReturnType<typeof setInterval> | null = null;
let rebalanceTimer: ReturnType<typeof setInterval> | null = null;
let monitorRunning = false;
let rebalanceRunning = false;

function clampInterval(value: number, fallback: number) {
  if (!Number.isFinite(value) || value < 15_000) {
    return fallback;
  }
  return Math.floor(value);
}

async function runMonitorCycle() {
  if (monitorRunning) {
    return;
  }

  monitorRunning = true;
  try {
    await monitorActiveGridStrategies();
  } catch (error) {
    console.error("[GridGuard] monitor cycle failed", error);
  } finally {
    monitorRunning = false;
  }
}

async function runRebalanceCycle() {
  if (rebalanceRunning || !hasOkxPrivateCredentials()) {
    return;
  }

  rebalanceRunning = true;
  try {
    const strategies = await listActiveGridStrategies();

    for (const strategy of strategies) {
      if (!strategy.algoId || strategy.status === "circuit_breaker") {
        continue;
      }

      try {
        const decision = await analyzeAndTuneGridStrategy({
          algoId: strategy.algoId,
          instId: strategy.instId,
          accountBudget: strategy.budget,
          riskLevel: strategy.riskLevel as "保守" | "均衡" | "进取",
          maxDrawdownRatio: strategy.circuitBreaker.thresholdRatio || ENV.okxGridMaxDrawdownRatio,
          abnormalFundingRateThreshold: ENV.okxGridAbnormalFundingRateThreshold,
        });

        await markGridStrategyDecision(strategy.strategyId, decision.action, decision.reason);
        await appendGridStrategyLog({
          strategyId: strategy.strategyId,
          algoId: strategy.algoId,
          instId: strategy.instId,
          eventType: "decision",
          level: decision.action === "pause" ? "warn" : "info",
          message: `${strategy.instId} 调参决策：${decision.action}`,
          context: {
            reason: decision.reason,
            confidence: decision.confidence,
            riskAlerts: decision.riskAlerts,
            market: decision.market,
            optimized: decision.optimized,
            amendPayload: decision.amendPayload,
          },
        });

        if (decision.action === "hold") {
          await updateGridStrategy(strategy.strategyId, (current) => ({
            ...current,
            lastMessage: `${strategy.instId} 当前保持原参数运行：${decision.reason}`,
          }));
          continue;
        }

        if (!canSendGridMutation(decision.action === "amend" ? "amend" : "stop")) {
          await appendGridStrategyLog({
            strategyId: strategy.strategyId,
            algoId: strategy.algoId,
            instId: strategy.instId,
            eventType: "decision",
            level: "warn",
            message: `${strategy.instId} 已生成${decision.action}建议，但当前灰度开关未允许真实执行`,
            context: {
              executionMode: strategy.executionMode,
              decision,
            },
          });
          continue;
        }

        const executionResult = await applyDynamicGridDecision(decision);
        await appendGridStrategyLog({
          strategyId: strategy.strategyId,
          algoId: strategy.algoId,
          instId: strategy.instId,
          eventType: decision.action === "amend" ? "amend" : "stop",
          level: decision.action === "amend" ? "info" : "warn",
          message:
            decision.action === "amend"
              ? `${strategy.instId} 已按定时任务自动改参`
              : `${strategy.instId} 已按定时任务自动暂停策略`,
          context: {
            decision,
            executionResult,
          },
        });

        await updateGridStrategy(strategy.strategyId, (current) => ({
          ...current,
          status: decision.action === "pause" ? "paused" : current.status,
          lastMessage:
            decision.action === "amend"
              ? `${strategy.instId} 已自动改参：${decision.reason}`
              : `${strategy.instId} 已自动暂停：${decision.reason}`,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知调参异常";
        await appendGridStrategyLog({
          strategyId: strategy.strategyId,
          algoId: strategy.algoId,
          instId: strategy.instId,
          eventType: "error",
          level: "error",
          message: `${strategy.instId} 定时调参失败：${message}`,
        });
      }
    }
  } catch (error) {
    console.error("[GridGuard] rebalance cycle failed", error);
  } finally {
    rebalanceRunning = false;
  }
}

export function startGridStrategyGuard() {
  if (monitorTimer || rebalanceTimer) {
    return;
  }

  const monitorInterval = clampInterval(ENV.okxGridMonitorIntervalMs, 60_000);
  const rebalanceInterval = clampInterval(ENV.okxGridRebalanceIntervalMs, 3_600_000);

  void runMonitorCycle();
  void runRebalanceCycle();

  monitorTimer = setInterval(() => {
    void runMonitorCycle();
  }, monitorInterval);

  rebalanceTimer = setInterval(() => {
    void runRebalanceCycle();
  }, rebalanceInterval);

  console.log(`[GridGuard] started monitor=${monitorInterval}ms rebalance=${rebalanceInterval}ms`);
}

export function stopGridStrategyGuard() {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }

  if (rebalanceTimer) {
    clearInterval(rebalanceTimer);
    rebalanceTimer = null;
  }
}

export async function runGridStrategyGuardOnce() {
  await runMonitorCycle();
  await runRebalanceCycle();
}
