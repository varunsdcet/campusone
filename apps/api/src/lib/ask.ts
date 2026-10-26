const ASK_TIMEOUT_MS = 8_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = ASK_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type AskResult = {
  answer: string;
  model: string;
  source: "deepseek" | "humanitix" | "openai" | "anthropic" | "fallback";
};

async function callDeepSeek(
  systemPrompt: string,
  question: string,
  timeoutMs = ASK_TIMEOUT_MS,
  maxTokens?: number,
  json = false,
): Promise<AskResult> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY missing");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
  const response = await fetchWithTimeout(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    }),
  }, timeoutMs);
  if (!response.ok) throw new Error(`DeepSeek failed: ${response.status}`);
  const body = (await response.json()) as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
  if (body.choices?.[0]?.finish_reason === "length") throw new Error("DeepSeek answer was cut off at the token limit");
  const answer = body.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("DeepSeek empty answer");
  return { answer, model: `deepseek:${model}`, source: "deepseek" };
}

function askConfigured() {
  const url = process.env.HUMANITIX_ASK_URL;
  return Boolean(url && url !== "off");
}

async function callHumanitixAsk(systemPrompt: string, question: string, timeoutMs = ASK_TIMEOUT_MS): Promise<AskResult> {
  const url = process.env.HUMANITIX_ASK_URL;
  if (!url) throw new Error("HUMANITIX_ASK_URL missing");
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ system_prompt: systemPrompt, question }),
  }, timeoutMs);
  if (!response.ok) throw new Error(`Humanitix ask failed: ${response.status}`);
  const body = (await response.json()) as { success?: boolean; answer?: unknown; model?: string };
  if (!body?.success || body.answer == null) throw new Error("Humanitix ask returned empty answer");

  let answer = body.answer;
  if (typeof answer !== "string") {
    answer = JSON.stringify(answer);
  }
  return {
    answer: String(answer).trim(),
    model: body.model ? `humanitix:${body.model}` : "humanitix:ask",
    source: "humanitix",
  };
}

async function callOpenAi(systemPrompt: string, question: string, timeoutMs = ASK_TIMEOUT_MS, maxTokens?: number): Promise<AskResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    }),
  }, timeoutMs);
  if (!response.ok) throw new Error(`OpenAI failed: ${response.status}`);
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const answer = body.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("OpenAI empty answer");
  return { answer, model: process.env.OPENAI_MODEL || "gpt-4o-mini", source: "openai" };
}

async function callAnthropic(systemPrompt: string, question: string, timeoutMs = ASK_TIMEOUT_MS, maxTokens = 1024): Promise<AskResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    }),
  }, timeoutMs);
  if (!response.ok) throw new Error(`Anthropic failed: ${response.status}`);
  const body = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
  const answer = body.content?.find((c) => c.type === "text")?.text?.trim();
  if (!answer) throw new Error("Anthropic empty answer");
  return {
    answer,
    model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022",
    source: "anthropic",
  };
}

/** Long-form generation (lesson drafts etc.): same provider chain, longer timeout, throws when every provider fails. */
export async function generateWithAi(
  systemPrompt: string,
  prompt: string,
  timeoutMs = 75_000,
  options: { json?: boolean; maxTokens?: number } = {},
): Promise<AskResult> {
  const maxTokens = options.maxTokens ?? 8000;
  const attempts: Array<[string, () => Promise<AskResult>]> = [];
  if (process.env.DEEPSEEK_API_KEY) attempts.push(["deepseek", () => callDeepSeek(systemPrompt, prompt, timeoutMs, maxTokens, options.json)]);
  if (askConfigured()) attempts.push(["humanitix", () => callHumanitixAsk(systemPrompt, prompt, timeoutMs)]);
  if (process.env.ANTHROPIC_API_KEY) attempts.push(["anthropic", () => callAnthropic(systemPrompt, prompt, timeoutMs, maxTokens)]);
  if (process.env.OPENAI_API_KEY) attempts.push(["openai", () => callOpenAi(systemPrompt, prompt, timeoutMs, maxTokens)]);
  const errors: string[] = [];
  for (const [name, run] of attempts) {
    try {
      const result = await run();
      if (result.answer.trim()) return result;
      errors.push(`${name}: empty answer`);
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }
  throw Object.assign(new Error("The AI provider is unavailable right now. Please try again in a minute."), {
    status: 502,
    code: "AI_UNAVAILABLE",
    details: errors,
  });
}

export async function askHeritageAi(input: {
  question: string;
  systemPrompt?: string;
  role?: string;
}): Promise<AskResult> {
  const question = String(input.question || "").trim();
  if (!question) {
    throw Object.assign(new Error("question is required"), { status: 400 });
  }
  const systemPrompt =
    input.systemPrompt ||
    `You are Ask Heritage, the campus AI assistant for MyHeritage.
Help ${input.role || "campus"} users with courses, grades, schedules, fees, attendance, and campus policies.
Be concise, accurate, and cite which campus area the answer relates to.
Never invent student grades or financial balances — tell the user to open the relevant portal screen.`;

  const errors: string[] = [];
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const result = await callDeepSeek(systemPrompt, question, 20_000);
      if (!result.answer || result.answer.trim().toLowerCase() === question.toLowerCase()) {
        throw new Error("DeepSeek returned empty or echoed question");
      }
      return result;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "deepseek failed");
    }
  }
  if (askConfigured()) {
    try {
      const result = await callHumanitixAsk(systemPrompt, question);
      if (!result.answer || result.answer.trim().toLowerCase() === question.toLowerCase()) {
        throw new Error("Humanitix returned empty or echoed question");
      }
      return result;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "humanitix failed");
    }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await callAnthropic(systemPrompt, question);
      if (!result.answer || result.answer.trim().toLowerCase() === question.toLowerCase()) {
        throw new Error("Anthropic returned empty or echoed question");
      }
      return result;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "anthropic failed");
    }
  }
  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await callOpenAi(systemPrompt, question);
      if (!result.answer || result.answer.trim().toLowerCase() === question.toLowerCase()) {
        throw new Error("OpenAI returned empty or echoed question");
      }
      return result;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "openai failed");
    }
  }

  if (errors.length) console.error("askHeritageAi providers failed", errors);
  return {
    answer: [
      "I couldn't reach the live AI provider just now.",
      "Try Global Search for people/courses, or open Grades, Fees, Attendance, and Schedule from your portal.",
    ].join("\n"),
    model: "fallback",
    source: "fallback",
  };
}
