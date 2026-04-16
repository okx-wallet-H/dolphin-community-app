import { getDefaultOkxBusinessSubscriptions, getOkxBusinessWsUrl } from "./config";
import {
  OkxPublicWsGatewayOptions,
  OkxPublicWsMessageHandler,
  OkxPublicWsStateHandler,
  OkxWsGatewayState,
  OkxWsRawMessage,
  OkxWsSubscriptionArg,
} from "./types";

function stringifySubscription(arg: OkxWsSubscriptionArg) {
  return `${arg.channel}:${arg.instId}`;
}

/**
 * OKX Business WebSocket 网关。
 * 主要承载 K 线等 business 频道，避免误连 public 端点导致 candle 订阅失败。
 */
export class OkxBusinessWsGateway {
  private readonly url: string;
  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly heartbeatIntervalMs: number;
  private readonly pongTimeoutMs: number;
  private readonly logger;

  private ws: WebSocket | null = null;
  private state: OkxWsGatewayState = "idle";
  private manualClose = false;
  private reconnectAttempts = 0;
  private awaitingPong = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly subscriptions = new Map<string, OkxWsSubscriptionArg>();
  private readonly messageHandlers = new Set<OkxPublicWsMessageHandler>();
  private readonly stateHandlers = new Set<OkxPublicWsStateHandler>();

  constructor(options?: OkxPublicWsGatewayOptions) {
    this.url = options?.url ?? getOkxBusinessWsUrl();
    this.reconnectBaseDelayMs = options?.reconnectBaseDelayMs ?? 1_500;
    this.reconnectMaxDelayMs = options?.reconnectMaxDelayMs ?? 30_000;
    this.heartbeatIntervalMs = options?.heartbeatIntervalMs ?? 20_000;
    this.pongTimeoutMs = options?.pongTimeoutMs ?? 8_000;
    this.logger = options?.logger;

    getDefaultOkxBusinessSubscriptions().forEach((arg) => {
      this.subscriptions.set(stringifySubscription(arg), arg);
    });
  }

  getCurrentState() {
    return this.state;
  }

  onMessage(handler: OkxPublicWsMessageHandler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStateChange(handler: OkxPublicWsStateHandler) {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  connect() {
    if (this.state === "connecting" || this.state === "connected") {
      return;
    }

    const WebSocketCtor = globalThis.WebSocket;
    if (!WebSocketCtor) {
      throw new Error("当前运行环境不支持 WebSocket");
    }

    this.manualClose = false;
    this.setState(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");
    this.logger?.info?.("正在连接 OKX Business WebSocket", { url: this.url });

    this.ws = new WebSocketCtor(this.url);
    this.bindSocketEvents(this.ws);
  }

  disconnect(reason = "manual-close") {
    this.logger?.info?.("主动关闭 OKX Business WebSocket", { reason });
    this.manualClose = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.awaitingPong = false;
    this.ws?.close();
    this.ws = null;
    this.setState("closed");
  }

  subscribe(args: OkxWsSubscriptionArg[]) {
    args.forEach((arg) => {
      this.subscriptions.set(stringifySubscription(arg), arg);
    });

    if (this.state === "connected") {
      this.sendJson({ op: "subscribe", args });
    }
  }

  unsubscribe(args: OkxWsSubscriptionArg[]) {
    args.forEach((arg) => {
      this.subscriptions.delete(stringifySubscription(arg));
    });

    if (this.state === "connected") {
      this.sendJson({ op: "unsubscribe", args });
    }
  }

  private bindSocketEvents(socket: WebSocket) {
    socket.onopen = () => {
      this.logger?.info?.("OKX Business WebSocket 已连接");
      this.reconnectAttempts = 0;
      this.awaitingPong = false;
      this.setState("connected");
      this.flushSubscriptions();
      this.startHeartbeat();
    };

    socket.onmessage = (event) => {
      const raw = typeof event.data === "string" ? event.data : String(event.data);

      if (raw === "pong") {
        this.awaitingPong = false;
        this.clearPongTimer();
        this.logger?.debug?.("收到 OKX business pong");
        return;
      }

      try {
        const message = JSON.parse(raw) as OkxWsRawMessage;
        this.messageHandlers.forEach((handler) => handler(message));
      } catch (error) {
        this.logger?.warn?.("解析 Business WebSocket 消息失败", {
          error: error instanceof Error ? error.message : String(error),
          raw,
        });
      }
    };

    socket.onerror = (event) => {
      this.logger?.error?.("OKX Business WebSocket 发生错误", {
        event: typeof event === "object" ? JSON.stringify(event) : String(event),
      });
    };

    socket.onclose = (event) => {
      this.logger?.warn?.("OKX Business WebSocket 已关闭", {
        code: event.code,
        reason: event.reason,
      });
      this.stopHeartbeat();
      this.ws = null;
      if (!this.manualClose) {
        this.scheduleReconnect();
        return;
      }
      this.setState("closed");
    };
  }

  private flushSubscriptions() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.subscriptions.size === 0) {
      return;
    }

    this.sendJson({
      op: "subscribe",
      args: Array.from(this.subscriptions.values()),
    });
  }

  private sendJson(payload: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(payload));
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      if (this.awaitingPong) {
        this.logger?.warn?.("上一个 business ping 未收到 pong，准备重连");
        this.ws.close();
        return;
      }

      this.awaitingPong = true;
      this.ws.send("ping");
      this.logger?.debug?.("发送 OKX business ping");
      this.pongTimer = setTimeout(() => {
        if (!this.awaitingPong) {
          return;
        }
        this.logger?.warn?.("business pong 超时，准备重连");
        this.ws?.close();
      }, this.pongTimeoutMs);
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearPongTimer();
  }

  private clearPongTimer() {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();
    this.reconnectAttempts += 1;
    const delay = Math.min(this.reconnectBaseDelayMs * 2 ** (this.reconnectAttempts - 1), this.reconnectMaxDelayMs);
    this.setState("reconnecting");
    this.logger?.warn?.("准备重连 OKX Business WebSocket", { attempt: this.reconnectAttempts, delay });
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(nextState: OkxWsGatewayState) {
    this.state = nextState;
    this.stateHandlers.forEach((handler) => handler(nextState));
  }
}
