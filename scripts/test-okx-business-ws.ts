import { OkxBusinessWsGateway, OkxWsDataEnvelope, OkxWsRawMessage } from "../src/services/okx";
import { getDefaultOkxBusinessSubscriptions } from "../src/services/okx/config";

const gateway = new OkxBusinessWsGateway({
  logger: {
    info: (message, extra) => console.log("[info]", message, extra ?? ""),
    warn: (message, extra) => console.log("[warn]", message, extra ?? ""),
    error: (message, extra) => console.log("[error]", message, extra ?? ""),
  },
  heartbeatIntervalMs: 10_000,
  pongTimeoutMs: 4_000,
});

const subscriptions = getDefaultOkxBusinessSubscriptions();
const liveData = new Set<string>();

const stop = setTimeout(() => {
  console.error("Business WebSocket 烟雾测试超时");
  gateway.disconnect("timeout");
  process.exit(1);
}, 20_000);

function isDataEnvelope(message: OkxWsRawMessage): message is OkxWsDataEnvelope<unknown> {
  return "arg" in message && "data" in message && Array.isArray((message as OkxWsDataEnvelope<unknown>).data);
}

function maybeFinish() {
  const required = ["candle1m:BTC-USDT-SWAP", "candle1m:ETH-USDT-SWAP"];

  if (required.every((item) => liveData.has(item))) {
    clearTimeout(stop);
    console.log("Business WebSocket 烟雾测试通过");
    gateway.disconnect("completed");
    process.exit(0);
  }
}

gateway.onMessage((message) => {
  if ("event" in message) {
    console.log("[event]", JSON.stringify(message));
  }

  if (!isDataEnvelope(message)) {
    return;
  }

  const key = `${message.arg.channel}:${message.arg.instId}`;
  if (message.data.length > 0) {
    liveData.add(key);
    console.log("[message]", key, JSON.stringify(message.data[0] ?? null));
    maybeFinish();
  }
});

gateway.subscribe(subscriptions);
gateway.connect();
