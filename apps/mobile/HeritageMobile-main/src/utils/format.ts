import { clock } from './clock';

export function formatMoney(amount: number, currency = 'CAD'): string {
  const abs = Math.abs(amount);
  const str = abs.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${amount < 0 ? '-' : ''}$${str} ${currency}`;
}

export function formatMoneyParen(amount: number): string {
  const abs = Math.abs(amount);
  const str = abs.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount < 0 ? `($${str})` : `$${str}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parseISODate(iso: string): Date {
  // Accept YYYY-MM-DD (treated as local date) or full ISO timestamps.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(iso);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

let displayTimeZone: string | undefined;

/** Zone used to read the calendar day of full timestamps in `formatDate` (the signed-in user's campus zone). */
export function setDisplayTimeZone(timeZone?: string) {
  displayTimeZone = timeZone;
}

/** e.g. "Sep 14, 2026" */
export function formatDate(iso: string | Date, opts: { long?: boolean; weekday?: boolean; dot?: boolean } = {}): string {
  const d = typeof iso !== 'string' ? iso : /^\d{4}-\d{2}-\d{2}$/.test(iso) ? parseISODate(iso) : shiftToZone(new Date(iso), displayTimeZone);
  if (Number.isNaN(d.getTime())) return '—';
  const month = opts.long ? MONTHS_LONG[d.getMonth()] : MONTHS[d.getMonth()] + (opts.dot ? '.' : '');
  const base = `${month} ${d.getDate()}, ${d.getFullYear()}`;
  if (opts.weekday) return `${base} (${DAYS[d.getDay()]}.)`;
  return base;
}

/** Shifts an instant so that local getters read the wall-clock time in `timeZone`. */
function shiftToZone(d: Date, timeZone?: string): Date {
  if (!timeZone) return d;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d);
    const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? '0');
    return new Date(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  } catch {
    return d;
  }
}

/** e.g. "3 Oct 2026, 05:29" (wall-clock time in the given IANA zone; the instant is never changed). */
export function formatDateTime(iso: string | Date, timeZone?: string): string {
  const d0 = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d0.getTime())) return '—';
  const d = shiftToZone(d0, timeZone);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatTime(d: Date, timeZone?: string, withSeconds = false): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', second: withSeconds ? '2-digit' : undefined, hour12: true, timeZone,
    }).format(d);
  } catch {
    return d.toLocaleTimeString();
  }
}

export function formatLongWeekdayDate(d: Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone }).format(d);
  } catch {
    return `${DAYS_LONG[d.getDay()]}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
}

export function weekdayShort(d: Date): string {
  return DAYS[d.getDay()];
}
export function weekdayLong(d: Date): string {
  return DAYS_LONG[d.getDay()];
}
export function monthLong(d: Date): string {
  return MONTHS_LONG[d.getMonth()];
}

export function daysUntil(iso: string): number {
  const target = new Date(iso).getTime();
  return Math.ceil((target - clock.now()) / (24 * 60 * 60 * 1000));
}

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

export function maskSensitive(value: string, visible = 0): string {
  if (!value) return '';
  const keep = value.slice(value.length - visible);
  return '•'.repeat(Math.max(0, value.length - visible)) + keep;
}
