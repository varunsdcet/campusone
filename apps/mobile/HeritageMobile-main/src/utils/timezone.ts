/**
 * IANA time-zone helpers. Offsets are computed with Intl for the given instant,
 * so daylight-saving changes are respected instead of hard-coding "UTC-08:00".
 */
export interface TimeZoneOption {
  id: string; // IANA
  label: string;
  abbr: string;
}

export const TIME_ZONES: TimeZoneOption[] = [
  { id: 'America/Vancouver', label: 'Pacific Time (US & Canada)', abbr: 'PT' },
  { id: 'America/Edmonton', label: 'Mountain Time (Canada)', abbr: 'MT' },
  { id: 'America/Regina', label: 'Central Standard Time (Saskatchewan)', abbr: 'CST' },
  { id: 'America/Winnipeg', label: 'Central Time (Canada)', abbr: 'CT' },
  { id: 'America/Toronto', label: 'Eastern Time (US & Canada)', abbr: 'ET' },
  { id: 'America/Halifax', label: 'Atlantic Time (Canada)', abbr: 'AT' },
  { id: 'America/St_Johns', label: 'Newfoundland Time', abbr: 'NT' },
  { id: 'UTC', label: 'Coordinated Universal Time', abbr: 'UTC' },
  { id: 'Europe/London', label: 'London', abbr: 'GMT/BST' },
  { id: 'Asia/Kolkata', label: 'India Standard Time', abbr: 'IST' },
  { id: 'Asia/Manila', label: 'Philippine Time', abbr: 'PHT' },
  { id: 'Australia/Sydney', label: 'Sydney', abbr: 'AEST' },
];

export function tzOffsetMinutes(tz: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at);
    const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? '0');
    const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
    return Math.round((asUTC - at.getTime()) / 60000);
  } catch {
    return 0;
  }
}

export function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const h = String(Math.floor(abs / 60)).padStart(2, '0');
  const m = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${h}:${m}`;
}

export function tzLabel(tz: string, at: Date): string {
  const opt = TIME_ZONES.find(t => t.id === tz);
  const off = formatOffset(tzOffsetMinutes(tz, at));
  return `(${off}) ${opt?.label ?? tz}`;
}

export function tzAbbr(tz: string, at: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(at);
    return parts.find(p => p.type === 'timeZoneName')?.value ?? TIME_ZONES.find(t => t.id === tz)?.abbr ?? '';
  } catch {
    return TIME_ZONES.find(t => t.id === tz)?.abbr ?? '';
  }
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Vancouver';
  } catch {
    return 'America/Vancouver';
  }
}
