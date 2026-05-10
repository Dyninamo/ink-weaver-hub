// Shared Anthropic Messages API helper for edge functions.
// Reads ANTHROPIC_API_KEY from env. Returns the response text or throws.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnthropicCallArgs {
  model?: string;                    // default: claude-haiku-4-5-20251001
  systemPrompt?: string;
  messages: AnthropicMessage[];
  maxTokens?: number;                // default: 1024
  temperature?: number;              // default: 0.4
}

export interface AnthropicCallResult {
  text: string;
  stop_reason: string | null;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  } | null;
}

export async function callAnthropic(args: AnthropicCallArgs): Promise<AnthropicCallResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set (Supabase project secret)");
  }
  const model = args.model ?? "claude-haiku-4-5-20251001";
  const body: Record<string, unknown> = {
    model,
    max_tokens: args.maxTokens ?? 1024,
    temperature: args.temperature ?? 0.4,
    messages: args.messages,
  };
  if (args.systemPrompt && args.systemPrompt.trim().length > 0) {
    body.system = args.systemPrompt;
  }
  const resp = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${errBody}`);
  }
  const json = await resp.json();
  const text = (json.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  return {
    text,
    stop_reason: json.stop_reason ?? null,
    model: json.model ?? model,
    usage: json.usage ? {
      input_tokens: json.usage.input_tokens ?? 0,
      output_tokens: json.usage.output_tokens ?? 0,
    } : null,
  };
}
