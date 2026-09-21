/** Shared OpenAI / AI Integrations env resolution for LexAssist routes. */

export function resolveAiApiKey(): string {
  return (
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ""
  ).trim();
}

export function resolveAiBaseUrl(): string | undefined {
  const base = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim();
  return base || undefined;
}

export function resolveAiModel(): string {
  return (
    process.env.AI_MODEL ||
    (resolveAiBaseUrl() ? "gpt-5.1" : "gpt-4o")
  );
}

/** True when a real key is configured (tests set AI_INTEGRATIONS_* to the mock). */
export function isAiConfigured(): boolean {
  const key = resolveAiApiKey();
  return key.length > 0 && key !== "placeholder";
}

export function aiNotConfiguredError(): { error: string; code: string } {
  return {
    error: "AI is not configured on this server",
    code: "AI_NOT_CONFIGURED",
  };
}
