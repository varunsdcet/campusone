import { hmIn, ymdIn } from "../../lib/workshopPolicy.js";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
/** Class sessions are stored in UTC; days, clock times and dates are read in the institution's zone, not the server's. */
export const DEFAULT_TZ = "America/Vancouver";

function formatClock(value: Date, tz: string) {
  const [h, m] = hmIn(value, tz).split(":").map(Number);
  const suffix = h! >= 12 ? "pm" : "am";
  return `${h! % 12 || 12}:${String(m).padStart(2, "0")}${suffix}`;
}

const weekdayIn = (value: Date, tz: string) => new Date(`${ymdIn(value, tz)}T12:00:00Z`).getUTCDay();

export function instructorDisplayName(person: { givenName: string; familyName: string } | null | undefined) {
  if (!person) return null;
  const family = person.familyName?.trim();
  const given = person.givenName?.trim();
  if (family && given) return `${family}, ${given}`;
  return family || given || null;
}

export function roomFromSessions(sessions: Array<{ location: string | null }>) {
  const room = sessions.map((s) => s.location?.trim()).find((v) => v);
  return room || null;
}

export function deliveryFromSessions(sessions: Array<{ deliveryMode: string }>) {
  const mode = sessions[0]?.deliveryMode;
  if (!mode) return null;
  if (mode === "in_person") return "In person";
  if (mode === "online" || mode === "remote") return "Online";
  if (mode === "hybrid") return "Hybrid";
  return mode.replace(/_/g, " ");
}

export function scheduleTextFromSessions(sessions: Array<{ startsAt: Date; endsAt: Date | null }>, tz: string = DEFAULT_TZ): string | null {
  if (sessions.length === 0) return null;
  const byDay = new Map<number, string>();
  for (const session of sessions) {
    const day = weekdayIn(session.startsAt, tz);
    if (byDay.has(day)) continue;
    const start = formatClock(session.startsAt, tz);
    const end = session.endsAt ? formatClock(session.endsAt, tz) : null;
    byDay.set(day, end ? `${WEEKDAYS[day]}: ${start} - ${end}` : `${WEEKDAYS[day]}: ${start}`);
  }
  const lines = WEEKDAY_ORDER.map((d) => byDay.get(d)).filter(Boolean) as string[];
  return lines.length > 0 ? lines.join("\n") : null;
}

export function dateBoundsFromSessions(sessions: Array<{ startsAt: Date; endsAt: Date | null }>, tz: string = DEFAULT_TZ) {
  if (sessions.length === 0) return { startsOn: null as string | null, endsOn: null as string | null };
  const starts = sessions.map((s) => s.startsAt.getTime());
  const ends = sessions.map((s) => (s.endsAt ?? s.startsAt).getTime());
  return { startsOn: ymdIn(new Date(Math.min(...starts)), tz), endsOn: ymdIn(new Date(Math.max(...ends)), tz) };
}
