import type { WorkshopWithStatus } from '../../../services/contracts/academics';
import { formatDate } from '../../../utils/format';
import { clock } from '../../../utils/clock';

const DAY_MS = 86_400_000;

function localDateStart(timestamp: number): number {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function workshopTiming(w: WorkshopWithStatus) {
  const start = new Date(`${w.date}T${w.startTime}:00`).getTime();
  // The API models a multi-day workshop as a date range plus its daily duration.
  const lastStart = w.endDate ? new Date(`${w.endDate}T${w.startTime}:00`).getTime() : start;
  const end = lastStart + w.durationHours * 3_600_000;
  const now = clock.now();
  const d = new Date(now);
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayStart = w.endDate ? new Date(`${today}T${w.startTime}:00`).getTime() : start;
  const sessionStart = now > start && now <= end ? todayStart : start;
  return {
    start,
    end,
    isPast: now > end,
    isStarted: now >= start,
    isLive: now >= sessionStart - 15 * 60_000 && now <= sessionStart + w.durationHours * 3_600_000 && now <= end,
    calendarDays: Math.round((localDateStart(start) - localDateStart(now)) / DAY_MS),
  };
}

export function workshopBanner(w: WorkshopWithStatus): { title: string; text?: string; tone: 'green' | 'gold' } {
  const timing = workshopTiming(w);
  if (timing.isLive) {
    return { title: 'A session is live now', text: w.location ? `Location: ${w.location}` : undefined, tone: 'green' };
  }
  if (timing.isStarted && !timing.isPast) {
    return {
      title: 'Workshop in progress',
      text: w.endDate ? `Runs through ${formatDate(w.endDate)}` : undefined,
      tone: 'green',
    };
  }
  if (timing.calendarDays <= 0) return { title: 'Session starts today', text: w.location ? `Location: ${w.location}` : undefined, tone: 'gold' };
  if (timing.calendarDays === 1) return { title: 'Session starts tomorrow', text: w.location ? `Location: ${w.location}` : undefined, tone: 'gold' };
  return { title: `Session starts in ${timing.calendarDays} days`, text: w.location ? `Location: ${w.location}` : undefined, tone: 'gold' };
}

/** Avoids rendering "CODE · CODE · Title" when an API title already includes its code. */
export function workshopDisplayTitle(w: Pick<WorkshopWithStatus, 'code' | 'title'>): string {
  const title = w.title.trim();
  if (!title || !w.code.trim()) return title || w.code;
  const escapedCode = w.code.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withoutCodePrefix = title.replace(new RegExp(`^${escapedCode}\\s*(?:[·:|–—-])\\s*`, 'i'), '').trim() || title;
  // QA/imported workshops sometimes append the same long numeric identifier to
  // both code and title. Keep it available in the code field without repeating
  // it in the human-readable heading.
  const generatedId = /(\d{6,})$/.exec(w.code.trim())?.[1];
  return generatedId ? withoutCodePrefix.replace(new RegExp(`\\s+${generatedId}$`), '').trim() || withoutCodePrefix : withoutCodePrefix;
}

export function workshopScheduleLabel(w: Pick<WorkshopWithStatus, 'mode' | 'startTime'>): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(w.startTime);
  if (!match) return w.mode;
  const hour = Number(match[1]);
  const minute = match[2];
  const displayHour = hour % 12 || 12;
  return `${w.mode} · ${displayHour}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
}
