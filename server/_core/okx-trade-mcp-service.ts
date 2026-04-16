import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const DEFAULT_OKX_API_KEY = "8e00ed1b-506c-41a7-b773-4b60ced23a47";
const DEFAULT_OKX_SECRET_KEY = "593A437E1F3BD9502B33BE4D46B373C0";
const DEFAULT_OKX_PASSPHRASE = "Yy133678.";
const TRADE_MCP_PROFILE = "hwallet_strategy";

type TradeMcpToolResult = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  structuredContent?: unknown;
  isError?: boolean;
};

type TradeMcpResponseEnvelope = {
  tool?: string;
  ok?: boolean;
  error?: boolean;
  message?: string;
  data?: unknown;
  endpoint?: string;
  requestTime?: string;
  capabilities?: Record<string, unknown>;
  timestamp?: string;
};

function getCredential(name: "OKX_API_KEY" | "OKX_SECRET_KEY" | "OKX_PASSPHRASE") {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  switch (name) {
    case "OKX_API_KEY":
      return DEFAULT_OKX_API_KEY;
    case "OKX_SECRET_KEY":
      return DEFAULT_OKX_SECRET_KEY;
    case "OKX_PASSPHRASE":
      return DEFAULT_OKX_PASSPHRASE;
    default:
      return "";
  }
}

function buildProfileToml() {
  const apiKey = getCredential("OKX_API_KEY");
  const secretKey = getCredential("OKX_SECRET_KEY");
  const passphrase = getCredential("OKX_PASSPHRASE");

  return [
    `[profiles.${TRADE_MCP_PROFILE}]`,
    `api_key = "${apiKey}"`,
    `secret_key = "${secretKey}"`,
    `passphrase = "${passphrase}"`,
    `demo = false`,
    "",
  ].join("\n");
}

async function ensureTradeMcpProfileConfig() {
  const okxDir = path.join(os.homedir(), ".okx");
  const configPath = path.join(okxDir, "config.toml");
  const profileBlock = buildProfileToml();

  await fs.mkdir(okxDir, { recursive: true });

  let existing = "";
  try {
    existing = await fs.readFile(configPath, "utf8");
  } catch {
    existing = "";
  }

  const profilePattern = new RegExp(`\\[profiles\\.${TRADE_MCP_PROFILE}\\][\\s\\S]*?(?=\\n\\[|$)`, "m");
  const nextContent = existing.trim()
    ? profilePattern.test(existing)
      ? existing.replace(profilePattern, profileBlock.trimEnd())
      : `${existing.trimEnd()}\n\n${profileBlock}`
    : profileBlock;

  await fs.writeFile(configPath, `${nextContent.trimEnd()}\n`, "utf8");
}

function getTradeMcpServerEntry() {
  return path.resolve(process.cwd(), "node_modules/@okx_ai/okx-trade-mcp/dist/index.js");
}

function parseTextBlock(result: TradeMcpToolResult) {
  const textBlock = result.content?.find((item) => item?.type === "text");
  if (!textBlock?.text) {
    return null;
  }

  try {
    return JSON.parse(textBlock.text) as TradeMcpResponseEnvelope;
  } catch {
    return {
      message: textBlock.text,
    } satisfies TradeMcpResponseEnvelope;
  }
}

class OkxTradeMcpService {
  private client: Client | null = null;

  private transport: StdioClientTransport | null = null;

  private connectingPromise: Promise<Client> | null = null;

  private async connect() {
    if (this.client) {
      return this.client;
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = (async () => {
      await ensureTradeMcpProfileConfig();

      const transport = new StdioClientTransport({
        command: "node",
        args: [
          getTradeMcpServerEntry(),
          "--profile",
          TRADE_MCP_PROFILE,
          "--modules",
          "all",
          "--read-only",
        ],
        cwd: process.cwd(),
        stderr: "inherit",
      });

      const client = new Client(
        {
          name: "h-wallet-trade-mcp-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      await client.connect(transport);
      this.client = client;
      this.transport = transport;
      return client;
    })();

    try {
      return await this.connectingPromise;
    } finally {
      this.connectingPromise = null;
    }
  }

  async listTools() {
    const client = await this.connect();
    return client.listTools();
  }

  async callTool(name: string, args: Record<string, unknown> = {}) {
    const client = await this.connect();
    const result = (await client.callTool({
      name,
      arguments: args,
    })) as TradeMcpToolResult;

    const structured =
      result.structuredContent && typeof result.structuredContent === "object"
        ? (result.structuredContent as TradeMcpResponseEnvelope)
        : null;
    const textPayload = parseTextBlock(result);
    const payload = structured ?? textPayload ?? {};

    if (result.isError || payload.error || payload.ok === false) {
      throw new Error(payload.message || `${name} 调用失败`);
    }

    return payload;
  }
}

export const okxTradeMcpService = new OkxTradeMcpService();
