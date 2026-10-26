export const CAREER_PRACTICUM_HREF = "/student/f/st-17-practicum";

/** Returns a usable external application URL, or null when the value is not HTTPS. */
export function httpsCareerOpportunityHref(value: string | null | undefined): string | null {
  const href = value?.trim() ?? "";
  if (!/^https:\/\//i.test(href) || /\s/.test(href)) return null;
  try {
    const url = new URL(href);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password ? href : null;
  } catch {
    return null;
  }
}

/** Student rows may also point to the one approved first-party practicum flow. */
export function studentCareerOpportunityHref(value: string | null | undefined): string | null {
  const href = value?.trim() ?? "";
  if (href === CAREER_PRACTICUM_HREF) return href;
  return httpsCareerOpportunityHref(href);
}

/** Admin forms only expose values accepted by the application-link contract. */
export function adminCareerOpportunityHref(value: string | null | undefined): string {
  return studentCareerOpportunityHref(value) ?? "";
}
