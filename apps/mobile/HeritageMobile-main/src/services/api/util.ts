import type { Course, Section, Term } from '../../domain/types';
import type { SectionWithCourse } from '../contracts/academics';
import { appConfig } from '../../config/appConfig';

export const initials = (first?: string | null, last?: string | null) => `${(first ?? '').trim()[0] ?? ''}${(last ?? '').trim()[0] ?? ''}`.toUpperCase() || '?';

export const nowIso = () => new Date().toISOString();

/** Resolves an API-provided web href (absolute https or site-relative) to an absolute URL. */
export function webUrl(href?: string | null): string | undefined {
  if (!href) return undefined;
  if (/^https:\/\//i.test(href)) return href;
  return href.startsWith('/') && !href.startsWith('//') && appConfig.webOrigin ? `${appConfig.webOrigin}${href}` : undefined;
}

export const dateOnly = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

/** "Dahiya, Monica" → "Monica Dahiya" */
export function displayName(name?: string | null) {
  if (!name) return 'TBA';
  const [last, first] = name.split(',').map(s => s.trim());
  return first ? `${first} ${last}` : name;
}

export function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}

const DAY_INDEX: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function to24h(t: string): string {
  const m = /(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(t);
  if (!m) return '';
  let h = Number(m[1]);
  const ap = m[3]?.toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

/** Parses the API's "Monday: 10:00am - 3:00pm\nTuesday: …" schedule text. */
export function parseSchedule(text?: string | null): { label: string; meetingDays: number[]; startTime: string; endTime: string } {
  const lines = (text ?? '').split('\n').map(l => l.trim()).filter(Boolean);
  const days: number[] = [];
  let startTime = '';
  let endTime = '';
  for (const line of lines) {
    const [day, rest = ''] = line.split(/:\s(.+)/);
    const idx = DAY_INDEX[day.trim().toLowerCase()];
    const [from, to] = rest.split(/\s*[-–]\s*/);
    if (idx !== undefined && to) {
      days.push(idx);
      if (!startTime) startTime = to24h(from);
      if (!endTime) endTime = to24h(to);
    }
  }
  const short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const first = lines.find(l => /[-–]/.test(l)) ?? lines[0] ?? '';
  const times = first.includes(': ') ? first.slice(first.indexOf(': ') + 2) : '';
  const label = days.length ? `${days.map(d => short[d]).join(', ')}${times ? ` · ${times}` : ''}` : lines.join(' · ') || 'Schedule TBA';
  return { label, meetingDays: days, startTime, endTime };
}

export interface CourseRowDto {
  sectionId: string;
  courseCode: string;
  courseTitle: string;
  sectionCode: string;
  termName: string | null;
  credits: number | null;
  instructorName: string | null;
  enrolmentStatus?: string;
  courseStatus?: string | null;
  deliveryMethod?: string | null;
  location?: string | null;
  scheduleText?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  enrolmentCount?: number;
}

function sectionStatus(dto: CourseRowDto): Section['status'] {
  const s = (dto.courseStatus ?? '').toLowerCase();
  if (s === 'completed' || s === 'failed') return 'Completed';
  if (s === 'not_started' || s === 'upcoming') return 'Upcoming';
  const today = new Date().toISOString().slice(0, 10);
  if (dto.startsOn && dto.startsOn > today) return 'Upcoming';
  if (dto.endsOn && dto.endsOn < today) return 'Completed';
  return 'In Progress';
}

export function termFrom(name: string | null | undefined, startsOn?: string | null, endsOn?: string | null): Term {
  const today = new Date().toISOString().slice(0, 10);
  const status: Term['status'] = endsOn && endsOn < today ? 'past' : startsOn && startsOn > today ? 'upcoming' : 'current';
  const label = name || 'Current term';
  return { id: `term:${label}`, code: label, name: label, startDate: startsOn ?? '', endDate: endsOn ?? '', campus: '', status };
}

export function mapCourseRow(dto: CourseRowDto, instructorId = ''): SectionWithCourse {
  const sched = parseSchedule(dto.scheduleText);
  const course: Course = { id: `course:${dto.courseCode}`, code: dto.courseCode, title: dto.courseTitle, department: '', credits: dto.credits ?? 0, description: '' };
  const term = termFrom(dto.termName, dto.startsOn, dto.endsOn);
  return {
    id: dto.sectionId,
    courseId: course.id,
    sectionCode: dto.sectionCode,
    termId: term.id,
    instructorId,
    delivery: dto.deliveryMethod ?? '',
    location: dto.location ?? '',
    startDate: dto.startsOn ?? '',
    endDate: dto.endsOn ?? '',
    scheduleLabel: sched.label,
    meetingDays: sched.meetingDays,
    startTime: sched.startTime,
    endTime: sched.endTime,
    status: sectionStatus(dto),
    assessmentLabel: 'Standard Assessment',
    evaluation: [],
    objectives: '',
    description: '',
    syllabusFile: '',
    days: [],
    liveRoomReady: false,
    course,
    instructorName: displayName(dto.instructorName),
    term,
    enrolledCount: dto.enrolmentCount ?? 0,
  };
}

/** Small memo with TTL so list + detail screens don't refetch the same payload. */
export function cached<T>(ttlMs: number, load: () => Promise<T>) {
  let value: { at: number; data: Promise<T> } | null = null;
  const fn = () => {
    if (!value || Date.now() - value.at > ttlMs) {
      const data = load();
      value = { at: Date.now(), data };
      data.catch(() => {
        value = null;
      });
    }
    return value.data;
  };
  fn.invalidate = () => {
    value = null;
  };
  return fn as (() => Promise<T>) & { invalidate(): void };
}
