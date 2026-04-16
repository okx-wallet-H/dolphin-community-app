import { ENV } from "./env";
import { notifyOwner } from "./notification";
import {
  appendGridStrategyLog,
  findGridStrategyByAlgoId,
  GridStrategyMetrics,
  GridStrategyRecord,
  listActiveGridStrategies,
  markGridCircuitBreaker,
  markGridStrategyStopped,
  updateGridStrategy,
  updateGridStrategyMetrics,
} from "./grid-strategy-store";
import { OkxGridBotService } from "../../src/services/okx";

const okxGridBotService = new OkxGridBotService();

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function round(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function buildMetrics(record: GridStrategyRecord, order?: Record<string, unknown>, positions: Array<Record<string, unknown>> = []): GridStrategyMetrics {
  const totalUnrealizedPnl = positions.reduce((sum, item) => sum + toNumber(item.upl), 0);
  const totalPositionSize = positions.reduce((sum, item) => sum + Math.abs(toNumber(item.pos)), 0);
  const marginRatios = positions.map((item) => toNumber(item.mgnRatio)).filter((item) => item > 0);
  const averageMarginRatio = marginRatios.length > 0 ? marginRatios.reduce((sum, item) => sum + item, 0) / marginRatios.length : 0;
  const totalPnl = toNumber(order?.totalPnl) || totalUnrealizedPnl;
  const pnlRatio = toNumber(order?.pnlRatio) || (record.metrics?.pnlRatio ?? 0);
  const peakPnlRatio = Math.max(record.metrics?.peakPnlRatio ?? pnlRatio, pnlRatio);
  const maxDrawdownRatio = Math.max(record.metrics?.maxDrawdownRatio ?? 0, Math.max(peakPnlRatio - pnlRatio, pnlRatio < 0 ? Math.abs(pnlRatio) : 0));

  return {
    totalPnl: round(totalPnl, 6),
    pnlRatio: round(pnlRatio, 6),
    runtimeMinutes: round((Date.now() - record.createdAt) / 60000, 2),
    positionCount: positions.length,
    totalPositionSize: round(totalPositionSize, 6),
    totalUnrealizedPnl: round(totalUnrealizedPnl, 6),
    averageMarginRatio: round(averageMarginRatio, 6),
    peakPnlRatio: round(peakPnlRatio, 6),
    maxDrawdownRatio: round(maxDrawdownRatio, 6),
    updatedAt: Date.now(),
  };
}

async function triggerCircuitBreaker(record: GridStrategyRecord, reason: string) {
  if (!record.algoId) {
    return null;
  }

  const stopResult = await okxGridBotService.stopOrders({
    algoOrders: [
      {
        algoId: record.algoId,
        instId: record.instId,
        algoOrdType: "contract_grid",
        stopType: "1",
      },
    ],
  });

  await markGridCircuitBreaker(record.strategyId, reason);
  await appendGridStrategyLog({
    strategyId: record.strategyId,
    algoId: record.algoId,
    instId: record.instId,
    eventType: "circuit_breaker",
    level: "error",
    message: reason,
    context: {
      stopResult,
    },
  });

  await notifyOwner({
    title: `H Wallet 网格策略熔断：${record.instId}`,
    content: `${reason}\n策略ID：${record.strategyId}\nAlgo ID：${record.algoId}`,
  }).catch(() => false);

  return stopResult;
}

export async function monitorGridStrategy(record: GridStrategyRecord) {
  if (!record.algoId) {
    return record;
  }

  try {
    const [orderDetails, positions] = await Promise.all([
      okxGridBotService.getOrderDetails({
        algoOrdType: "contract_grid",
        algoId: record.algoId,
        instId: record.instId,
      }),
      okxGridBotService.getPositions({
        algoOrdType: "contract_grid",
        algoId: record.algoId,
        instId: record.instId,
      }),
    ]);

    const order = orderDetails[0] as Record<string, unknown> | undefined;
    const normalizedPositions = (positions as Array<Record<string, unknown>>) ?? [];
    const metrics = buildMetrics(record, order, normalizedPositions);
    await updateGridStrategyMetrics(record.strategyId, metrics);

    const latestStatus = String(order?.algoStatus ?? order?.state ?? "").toLowerCase();
    if (["stopped", "cancelled", "canceled", "failed"].includes(latestStatus)) {
      const message = `${record.instId} 网格策略已结束，状态：${latestStatus}`;
      await markGridStrategyStopped(record.strategyId, message);
      await appendGridStrategyLog({
        strategyId: record.strategyId,
        algoId: record.algoId,
        instId: record.instId,
        eventType: "monitor",
        level: latestStatus === "failed" ? "error" : "info",
        message,
        context: { order, positions: normalizedPositions, metrics },
      });
      return findGridStrategyByAlgoId(record.algoId);
    }

    const drawdownThreshold = record.circuitBreaker.thresholdRatio || ENV.okxGridMaxDrawdownRatio;
    const drawdown = metrics.maxDrawdownRatio ?? 0;
    if (!record.circuitBreaker.triggeredAt && drawdown >= drawdownThreshold) {
      const reason = `${record.instId} 策略最大回撤 ${(drawdown * 100).toFixed(2)}% 已超过阈值 ${(drawdownThreshold * 100).toFixed(2)}%，已自动熔断停机`;
      await triggerCircuitBreaker(record, reason);
      return findGridStrategyByAlgoId(record.algoId);
    }

    await updateGridStrategy(record.strategyId, (current) => ({
      ...current,
      status: current.status === "preview" ? "running" : current.status,
      lastMessage: `${record.instId} 监控更新：收益 ${(metrics.pnlRatio ?? 0) * 100}% / 未实现盈亏 ${metrics.totalUnrealizedPnl ?? 0} USDT`,
    }));

    await appendGridStrategyLog({
      strategyId: record.strategyId,
      algoId: record.algoId,
      instId: record.instId,
      eventType: "monitor",
      level: "info",
      message: `${record.instId} 监控指标已更新`,
      context: {
        order,
        positions: normalizedPositions,
        metrics,
      },
    });

    return findGridStrategyByAlgoId(record.algoId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知监控异常";
    await appendGridStrategyLog({
      strategyId: record.strategyId,
      algoId: record.algoId,
      instId: record.instId,
      eventType: "error",
      level: "error",
      message: `${record.instId} 监控失败：${message}`,
    });

    await updateGridStrategy(record.strategyId, (current) => ({
      ...current,
      status: current.status === "running" ? "error" : current.status,
      lastMessage: `${record.instId} 监控失败：${message}`,
    }));

    return findGridStrategyByAlgoId(record.algoId);
  }
}

export async function monitorActiveGridStrategies() {
  const activeStrategies = await listActiveGridStrategies();
  const results = [] as Array<GridStrategyRecord | undefined>;

  for (const strategy of activeStrategies) {
    results.push(await monitorGridStrategy(strategy));
  }

  return results;
}
