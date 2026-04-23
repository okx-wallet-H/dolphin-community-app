import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice = ToolChoicePrimitive | ToolChoiceByName | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  temperature?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (value: MessageContent | MessageContent[]): MessageContent[] =>
  Array.isArray(value) ? value : [value];

const normalizeContentPart = (part: MessageContent): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined,
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error("tool_choice 'required' was provided but no tools were configured");
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly",
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const normalizeApiUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim().replace(/\/$/, "");
  if (!trimmed) {
    return "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  }

  if (/\/chat\/completions$/i.test(trimmed)) {
    return trimmed;
  }

  if (/\/(v1|api\/paas\/v4)$/i.test(trimmed)) {
    return `${trimmed}/chat/completions`;
  }

  return `${trimmed}/chat/completions`;
};

const normalizeAnthropicApiUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim().replace(/\/$/, "");
  if (!trimmed) {
    return "https://api.anthropic.com/v1/messages";
  }

  if (/\/messages$/i.test(trimmed)) {
    return trimmed;
  }

  if (/\/v1$/i.test(trimmed)) {
    return `${trimmed}/messages`;
  }

  return `${trimmed}/v1/messages`;
};

const resolveProvider = () => (ENV.llmProvider === "anthropic" ? "anthropic" : "openai-compatible");

const resolveApiUrl = () =>
  resolveProvider() === "anthropic"
    ? normalizeAnthropicApiUrl(ENV.anthropicApiUrl)
    : normalizeApiUrl(ENV.llmApiUrl || ENV.forgeApiUrl);

const resolveApiKey = () =>
  resolveProvider() === "anthropic"
    ? ENV.anthropicApiKey
    : (ENV.llmApiKey || ENV.forgeApiKey);

const resolveModel = () =>
  resolveProvider() === "anthropic"
    ? (ENV.anthropicModel?.trim() || "claude-3-5-sonnet-latest")
    : (ENV.llmModel?.trim() || "glm-5.1");

const assertApiKey = () => {
  if (!resolveApiKey()) {
    throw new Error(resolveProvider() === "anthropic" ? "ANTHROPIC_API_KEY is not configured" : "LLM_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error("responseFormat json_schema requires a defined schema object");
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

function serializeAnthropicContent(part: MessageContent) {
  if (typeof part === "string") {
    return part;
  }

  if (part.type === "text") {
    return part.text;
  }

  if (part.type === "image_url") {
    return `[image] ${part.image_url.url}`;
  }

  if (part.type === "file_url") {
    return `[file] ${part.file_url.url}`;
  }

  return JSON.stringify(part);
}

function normalizeAnthropicMessages(messages: Message[]) {
  const systemParts: string[] = [];
  const anthropicMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const message of messages) {
    const content = ensureArray(message.content)
      .map(serializeAnthropicContent)
      .join("\n")
      .trim();

    if (!content) continue;

    if (message.role === "system") {
      systemParts.push(content);
      continue;
    }

    if (message.role === "assistant") {
      anthropicMessages.push({ role: "assistant", content });
      continue;
    }

    anthropicMessages.push({ role: "user", content });
  }

  if (anthropicMessages.length === 0) {
    anthropicMessages.push({ role: "user", content: "继续。" });
  }

  return {
    system: systemParts.join("\n\n").trim() || undefined,
    messages: anthropicMessages,
  };
}

function normalizeAnthropicResult(payload: Record<string, unknown>, model: string): InvokeResult {
  const contentParts = Array.isArray(payload.content) ? payload.content : [];
  const text = contentParts
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const typedPart = part as Record<string, unknown>;
      return typedPart.type === "text" && typeof typedPart.text === "string" ? typedPart.text : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();

  const usage = payload.usage && typeof payload.usage === "object"
    ? payload.usage as Record<string, unknown>
    : undefined;
  const promptTokens = Number(usage?.input_tokens ?? 0);
  const completionTokens = Number(usage?.output_tokens ?? 0);

  return {
    id: String(payload.id ?? `anthropic-${Date.now()}`),
    created: Math.floor(Date.now() / 1000),
    model: String(payload.model ?? model),
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text,
        },
        finish_reason: typeof payload.stop_reason === "string" ? payload.stop_reason : null,
      },
    ],
    usage: {
      prompt_tokens: Number.isFinite(promptTokens) ? promptTokens : 0,
      completion_tokens: Number.isFinite(completionTokens) ? completionTokens : 0,
      total_tokens: (Number.isFinite(promptTokens) ? promptTokens : 0) + (Number.isFinite(completionTokens) ? completionTokens : 0),
    },
  };
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    temperature,
    maxTokens,
    max_tokens,
  } = params;

  const provider = resolveProvider();
  const model = resolveModel();
  const maxTokensValue = typeof maxTokens === "number"
    ? maxTokens
    : (typeof max_tokens === "number" ? max_tokens : undefined);

  if (provider === "anthropic") {
    if (tools && tools.length > 0) {
      throw new Error("Anthropic provider does not yet support tool calling in this wrapper");
    }

    if (toolChoice || tool_choice) {
      throw new Error("Anthropic provider does not yet support tool_choice in this wrapper");
    }

    const normalizedAnthropic = normalizeAnthropicMessages(messages);
    const payload: Record<string, unknown> = {
      model,
      max_tokens: Number.isFinite(maxTokensValue) ? maxTokensValue : 4096,
      messages: normalizedAnthropic.messages,
    };

    if (normalizedAnthropic.system) {
      payload.system = normalizedAnthropic.system;
    }

    if (typeof temperature === "number" && Number.isFinite(temperature)) {
      payload.temperature = temperature;
    }

    const response = await fetch(resolveApiUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": resolveApiKey(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
    }

    return normalizeAnthropicResult((await response.json()) as Record<string, unknown>, model);
  }

  const payload: Record<string, unknown> = {
    model,
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens = Number.isFinite(maxTokensValue) ? maxTokensValue : 32768;
  if (typeof temperature === "number" && Number.isFinite(temperature)) {
    payload.temperature = temperature;
  }
  payload.thinking = {
    budget_tokens: 128,
  };

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${resolveApiKey()}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  return (await response.json()) as InvokeResult;
}
