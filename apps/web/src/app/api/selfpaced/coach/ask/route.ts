import { NextRequest, NextResponse } from "next/server";
import { getActivity, getChapter, getCurriculum } from "@/lib/selfpacedCurriculum";
import { getSelfpacedProgram } from "@/lib/selfpacedPrograms";
import { API_URL } from "@/lib/api";
import { requireWebApiSession } from "@/lib/serverRouteAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_ASK_URL = "https://onlinemandiapp.com/Humanitix/api/ask";
const ASK_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = ASK_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type AskResult = { answer: string; model: string; source: string };

async function callHumanitix(systemPrompt: string, question: string): Promise<AskResult> {
  const url = process.env.HUMANITIX_ASK_URL || DEFAULT_ASK_URL;
  if (!url || url === "off") throw new Error("humanitix off");
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ system_prompt: systemPrompt, question }),
  });
  if (!response.ok) throw new Error(`Humanitix ${response.status}`);
  const body = (await response.json()) as { success?: boolean; answer?: unknown; model?: string };
  if (!body?.success || body.answer == null) throw new Error("empty humanitix");
  return {
    answer: String(body.answer).trim(),
    model: body.model ? `humanitix:${body.model}` : "humanitix",
    source: "humanitix",
  };
}

async function callDeepSeek(systemPrompt: string, question: string): Promise<AskResult> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("no deepseek");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
  const response = await fetchWithTimeout(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    }),
  }, 20_000);
  if (!response.ok) throw new Error(`deepseek ${response.status}`);
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const answer = body.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("empty deepseek");
  return { answer, model: `deepseek:${model}`, source: "deepseek" };
}

async function callOpenAi(systemPrompt: string, question: string): Promise<AskResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("no openai");
  const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    }),
  });
  if (!response.ok) throw new Error(`openai ${response.status}`);
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const answer = body.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("empty openai");
  return { answer, model: process.env.OPENAI_MODEL || "gpt-4o-mini", source: "openai" };
}

async function callAnthropic(systemPrompt: string, question: string): Promise<AskResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("no anthropic");
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!response.ok) throw new Error(`anthropic ${response.status}`);
  const body = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
  const answer = body.content?.find((c) => c.type === "text")?.text?.trim();
  if (!answer) throw new Error("empty anthropic");
  return {
    answer,
    model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022",
    source: "anthropic",
  };
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type EnrolledScope = {
  slug: string;
  /** How many chapters are currently open (pass+date gate), 1-based count. */
  openChapterCount: number;
};

function buildUnlockedCorpus(enrolled: EnrolledScope[], preferSlug?: string, preferChapterId?: string) {
  const chunks: string[] = [];
  const titles: string[] = [];

  const ordered = [...enrolled].sort((a, b) => {
    if (preferSlug && a.slug === preferSlug) return -1;
    if (preferSlug && b.slug === preferSlug) return 1;
    return 0;
  });

  for (const item of ordered) {
    const program = getSelfpacedProgram(item.slug);
    if (!program) continue;
    const chapters = getCurriculum(item.slug);
    const open = Math.max(0, Math.min(item.openChapterCount || 0, chapters.length));
    if (open <= 0) continue;
    titles.push(`${program.title} (${open}/${chapters.length} chapters open)`);
    chunks.push(
      `=== Purchased program: ${program.title} (${program.subject}, ${program.level}) ===\n${program.blurb}\nOpen chapters: ${open} of ${chapters.length}`,
    );

    for (let i = 0; i < open; i++) {
      const ch = chapters[i];
      const focus = preferSlug === item.slug && preferChapterId === ch.id;
      const budget = focus ? 4200 : 1800;
      const parts: string[] = [`Chapter ${i + 1}: ${ch.title}. ${ch.summary}`];
      for (const act of ch.activities) {
        if (act.type === "assessment") continue; // never index question banks
        if (act.html) parts.push(`${act.title}: ${stripHtml(act.html).slice(0, focus ? 2800 : 900)}`);
        if (act.storyboard) {
          parts.push(
            `Lecture “${act.title}”:\n${act.storyboard.slides
              .map((s) => `Slide ${s.number} ${s.heading}: ${s.narration}`)
              .join("\n")
              .slice(0, focus ? 2200 : 800)}`,
          );
        }
        if (act.pairs?.length) {
          parts.push(`Glossary: ${act.pairs.map((p) => `${p.left} = ${p.right}`).join("; ")}`.slice(0, 800));
        }
      }
      chunks.push(parts.join("\n").slice(0, budget));
    }
  }

  return { chunks, titles };
}

function buildContext(input: {
  slug?: string;
  chapterId?: string;
  activityId?: string;
  mode?: string;
  firstName?: string;
  extraSnippet?: string;
  enrolled?: EnrolledScope[];
}) {
  const enrolled =
    input.enrolled && input.enrolled.length > 0
      ? input.enrolled
      : input.slug
        ? [{ slug: input.slug, openChapterCount: 1 }]
        : [];

  const { chunks, titles } = buildUnlockedCorpus(enrolled, input.slug, input.chapterId);

  // Prefer current activity detail on top when present (still no assessment keys).
  if (input.slug && input.chapterId && input.activityId) {
    const found = getActivity(input.slug, input.chapterId, input.activityId);
    if (found && found.activity.type !== "assessment") {
      const act = found.activity;
      const detail: string[] = [`Current activity: ${act.title} (${act.type}) in ${found.chapter.title}`];
      if (act.html) detail.push(`Reading: ${stripHtml(act.html).slice(0, 3500)}`);
      if (act.storyboard) {
        detail.push(
          `Lecture slides:\n${act.storyboard.slides
            .map((s) => `Slide ${s.number} ${s.heading}: ${s.narration}`)
            .join("\n")
            .slice(0, 2500)}`,
        );
      }
      chunks.unshift(detail.join("\n"));
    }
  } else if (input.slug && input.chapterId) {
    const chapter = getChapter(input.slug, input.chapterId);
    if (chapter) chunks.unshift(`Focused chapter: ${chapter.title}. ${chapter.summary}`);
  }

  if (input.extraSnippet) chunks.push(input.extraSnippet.slice(0, 1500));

  const mode = input.mode || "on";
  const name = input.firstName || "Learner";
  const library =
    titles.length > 0
      ? `Learner's purchased & unlocked library: ${titles.join("; ")}.`
      : "Learner has no unlocked purchased content yet.";

  return `You are the Heritage eLearning coach for ${name}.
${library}
Answer ONLY from the unlocked course content below (purchased programmes, open chapters only). Do not use locked chapters or other programmes.
If the answer is not in the unlocked content, say you cannot find it in their open materials and suggest Ask a human.
Cite the reading title, section, or lecture slide number when possible.
Mode: ${mode}. ${mode === "off" ? "Refuse to help with graded answers." : mode === "hints" ? "Give hints and point to the reading section — never give the final answer." : "Explain clearly with Canadian workplace examples when helpful."}
For trades/health procedural steps, quote the course text and add: follow your site procedure and supervisor.
Never invent grades, prices, or identity data. Never reveal assessment answer keys.
Format answers in clear Markdown (short paragraphs, bullet lists when helpful).

UNLOCKED COURSE CONTENT:
${chunks.join("\n\n") || "No unlocked purchased content is available."}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireWebApiSession(req, ["student"]);
    if (session instanceof NextResponse) return session;
    const body = (await req.json()) as {
      question?: string;
      slug?: string;
      chapterId?: string;
      activityId?: string;
      mode?: string;
      firstName?: string;
      extraSnippet?: string;
      enrolled?: EnrolledScope[];
    };
    const question = String(body.question || "").trim();
    if (!question) {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }
    if (body.mode === "off") {
      return NextResponse.json({ error: "Coach disabled for graded work", code: "coach_disabled" }, { status: 403 });
    }

    const enrolmentResponse = await fetch(`${API_URL.replace(/\/$/, "")}/selfpaced/enrolments`, {
      headers: { authorization: session.authorization },
      cache: "no-store",
    });
    if (!enrolmentResponse.ok) {
      return NextResponse.json({ error: "Could not verify course enrolment." }, { status: 403 });
    }
    const verified = (await enrolmentResponse.json()) as {
      items?: Array<{ slug?: string; enrolledAt?: string }>;
    };
    const requested = new Map((body.enrolled || []).map((item) => [item.slug, item.openChapterCount]));
    const enrolled = (verified.items || []).flatMap((item) => {
      if (!item.slug || !requested.has(item.slug)) return [];
      const enrolledAt = item.enrolledAt ? new Date(item.enrolledAt) : new Date();
      const elapsedDays = Number.isNaN(enrolledAt.getTime())
        ? 0
        : Math.max(0, Math.floor((Date.now() - enrolledAt.getTime()) / 86_400_000));
      return [{ slug: item.slug, openChapterCount: Math.min(requested.get(item.slug) || 0, elapsedDays + 1) }];
    }).filter((item) => item.openChapterCount > 0);
    if (enrolled.length === 0 && !body.slug) {
      return NextResponse.json({
        ok: true,
        answer:
          "You do not have an unlocked purchased course yet. Enroll in a programme first, then ask about your open chapters.",
        model: "policy",
        source: "policy",
      });
    }

    const systemPrompt = buildContext({
      ...body,
      enrolled: enrolled.length
        ? enrolled
        : body.slug
          ? [{ slug: body.slug, openChapterCount: 1 }]
          : [],
    });
    const errors: string[] = [];
    for (const fn of [callDeepSeek, callHumanitix, callAnthropic, callOpenAi]) {
      try {
        const result = await fn(systemPrompt, question);
        if (result.answer && result.answer.toLowerCase() !== question.toLowerCase()) {
          return NextResponse.json({ ...result, ok: true });
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "provider failed");
      }
    }

    const hay = systemPrompt.toLowerCase();
    const tokens = question.toLowerCase().split(/\W+/).filter((t) => t.length > 3);
    const hits = tokens.filter((t) => hay.includes(t));
    const answer = hits.length
      ? `Based on **your unlocked course materials**: clarify the request, follow the chapter process, document the result, and confirm the next owner. Related ideas: ${hits.slice(0, 3).join(", ")}. Re-open the matching reading or lecture for the full explanation.`
      : `I cannot find that in your **purchased unlocked chapters**. Ask about an open reading, lecture, or glossary term — or use Ask a human.`;

    return NextResponse.json({ ok: true, answer, model: "fallback", source: "fallback", errors });
  } catch (err) {
    console.error("selfpaced coach ask", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Coach failed" },
      { status: 500 },
    );
  }
}
