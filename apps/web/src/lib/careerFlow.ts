export const CAREER_COACHING_TOPIC = "Career coaching";
export const CAREER_COACHING_SOURCE = "career";
export const CAREER_COACHING_NOTE = "Requested from Career & Opportunities";

const APPROVED_INTERNAL_APPLICATION_PATH = "/student/f/st-17-practicum";

export function careerCoachingHref() {
  const params = new URLSearchParams({
    topic: CAREER_COACHING_TOPIC,
    source: CAREER_COACHING_SOURCE,
  });
  return `/student/advising?${params.toString()}`;
}

export function readAdvisingPrefill(search: string): { topic: string | null; sourceNote: string | null } {
  const params = new URLSearchParams(search);
  const rawTopic = params.get("topic");
  const topic = rawTopic?.replace(/\s+/g, " ").trim() ?? "";

  return {
    topic: topic.length >= 3 && topic.length <= 200 ? topic : null,
    sourceNote:
      topic === CAREER_COACHING_TOPIC && params.get("source") === CAREER_COACHING_SOURCE
        ? CAREER_COACHING_NOTE
        : null,
  };
}

/**
 * Opportunity applications may use an approved HTTPS site or the exact
 * approved internal practicum route. Generic student routes (including the
 * legacy Messages fallback) are not application destinations.
 */
export function opportunityApplicationHref(href: string | null | undefined): string | null {
  const value = href?.trim();
  if (!value) return null;

  if (value.startsWith("/")) {
    return value === APPROVED_INTERNAL_APPLICATION_PATH ? value : null;
  }

  try {
    const url = new URL(value);
    return /^https:\/\//i.test(value) && url.protocol === "https:" && url.hostname && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
