import { z } from "zod";

export const StoryboardSlide = z.object({
  heading: z.string().min(1).max(200),
  bullets: z.array(z.string().max(400)).max(8).default([]),
  narration: z.string().min(1).max(3000),
});

export type AiDraftStoryboard = {
  title: string;
  estimated_duration_sec: number;
  slides: Array<{ number: number; heading: string; bullets: string[]; narration: string }>;
};

const ALLOWED_TAGS = new Set(["h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "b", "em", "i", "br", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "details", "summary", "code"]);

/** Whitelist sanitizer for lesson HTML that is rendered to students: known tags only, all attributes dropped. */
export function sanitizeLessonHtml(html: string) {
  return html
    .replace(/<(script|style|iframe|object|embed|svg|math)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?([a-z0-9]+)(\s[^>]*)?\/?>/gi, (tag, name: string) => {
      const n = name.toLowerCase();
      if (!ALLOWED_TAGS.has(n)) return "";
      return tag.startsWith("</") ? `</${n}>` : `<${n}>`;
    })
    .slice(0, 60_000);
}

export function normalizeStoryboard(raw: unknown, fallbackTitle: string, minutes?: number): AiDraftStoryboard | null {
  const parsed = z
    .object({ title: z.string().optional(), estimated_duration_sec: z.number().optional(), slides: z.array(StoryboardSlide).min(1).max(14) })
    .safeParse(raw);
  if (!parsed.success) return null;
  const strip = (t: string) => t.replace(/<[^>]*>/g, "").trim();
  const slides = parsed.data.slides.map((sl, i) => ({
    number: i + 1,
    heading: strip(sl.heading),
    bullets: sl.bullets.map(strip).filter(Boolean),
    narration: strip(sl.narration),
  }));
  const spoken = slides.reduce((n, sl) => n + sl.narration.split(/\s+/).length, 0);
  return {
    title: strip(parsed.data.title || fallbackTitle),
    estimated_duration_sec: Math.round(parsed.data.estimated_duration_sec || (minutes ? minutes * 60 : (spoken / 150) * 60)),
    slides,
  };
}
