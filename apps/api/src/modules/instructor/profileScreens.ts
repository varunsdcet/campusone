import { randomUUID } from "crypto";
import { prisma } from "@myheritage/db";

export const PROFILE_BIO_PATH = "/instructor/f/t02-profile-biography";
export const PROFILE_TOPICS_PATH = "/instructor/f/t03-profile-topics";
export const AVAILABILITY_PATH = "/instructor/f/t04-profile-availability";
export const PROFILE_SCHEDULE_PATH = "/instructor/f/t06-profile-schedule";
export const ACCOMPLISHMENTS_PATH = "/instructor/f/t34-accomplishments";

export const PROFILE_TABS = [
  { label: "Biography", href: PROFILE_BIO_PATH },
  { label: "Topics", href: PROFILE_TOPICS_PATH },
  { label: "Availability", href: AVAILABILITY_PATH },
  { label: "Compensation", href: "/instructor/f/t05-profile-compensation" },
  { label: "Schedule", href: PROFILE_SCHEDULE_PATH },
  { label: "Accomplishments", href: ACCOMPLISHMENTS_PATH },
] as const;

export const AVAILABILITY_TYPES = [
  { label: "Available to Teach", value: "Available to Teach" },
  { label: "Office Hours", value: "Office Hours" },
];

export type ProfileCtx = {
  user: { institutionId: string; accountId: string; personId: string };
  person: { givenName: string; familyName: string; email: string };
  displayName: string;
  sections: Array<{
    id: string;
    code: string;
    courseCode: string;
    courseTitle: string;
    termCode: string;
  }>;
  classSessions: Array<{
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date | null;
    location: string | null;
    sectionCode: string;
    courseCode: string;
    joinUrl: string | null;
  }>;
  term?: { name: string; code: string } | null;
  studentCount: number;
};

export type AvailabilitySlot = {
  id?: string;
  day: string;
  start: string;
  end: string;
  mode: string;
  location: string;
  date?: string;
  endDate?: string;
  repeats?: string;
  note?: string;
  title?: string;
};

type ConnectPayload = { phone: string; email: string };
type EducationPayload = {
  background: string;
  experience: string;
  organizations: string;
};
type ProfileDetailsPayload = {
  displayName: string;
  preferredName: string;
  pronouns: string;
  office: string;
  department: string;
  rank: string;
  yearsTeaching: string;
  hireDate: string;
};

export function profileTabs(activeHref: string) {
  return PROFILE_TABS.map((t) => ({ ...t, active: t.href === activeHref }));
}

function weekdayFromIso(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

function formatClock(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function courseTopicLinks(
  ctx: ProfileCtx,
  codes: string[],
): Array<{ label: string; href: string }> {
  const byCode = new Map<string, string>();
  for (const s of ctx.sections) {
    if (!s.courseCode || byCode.has(s.courseCode)) continue;
    byCode.set(s.courseCode, `/instructor/sections/${s.id}`);
  }
  return [...new Set(codes.filter(Boolean))]
    .sort()
    .map((code) => ({
      label: code,
      href: byCode.get(code) || "/instructor/sections",
    }));
}

export function profileHeaderPayload(ctx: ProfileCtx) {
  const topics = [...new Set(ctx.sections.map((s) => s.courseCode).filter(Boolean))].sort();
  return {
    name: ctx.displayName,
    email: ctx.person.email,
    status: "Active",
    topics,
    topicLinks: courseTopicLinks(ctx, topics),
    avatarUrl: "",
  };
}

async function loadJsonRecord<T>(
  ctx: ProfileCtx,
  screenPath: string,
  key: string,
  fallback: T,
): Promise<T> {
  const row = await prisma.portalRecord.findFirst({
    where: {
      institutionId: ctx.user.institutionId,
      screenPath,
      role: "instructor",
      audienceAccountId: ctx.user.accountId,
      primaryText: key,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!row?.metaText) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(row.metaText) as T) };
  } catch {
    return fallback;
  }
}

async function upsertJsonRecord(ctx: ProfileCtx, screenPath: string, key: string, data: unknown) {
  const existing = await prisma.portalRecord.findFirst({
    where: {
      institutionId: ctx.user.institutionId,
      screenPath,
      role: "instructor",
      audienceAccountId: ctx.user.accountId,
      primaryText: key,
    },
  });
  const metaText = JSON.stringify(data);
  if (existing) {
    await prisma.portalRecord.update({
      where: { id: existing.id },
      data: { metaText, secondaryText: key },
    });
    return existing.id;
  }
  const id = randomUUID();
  await prisma.portalRecord.create({
    data: {
      id,
      institutionId: ctx.user.institutionId,
      screenPath,
      role: "instructor",
      primaryText: key,
      secondaryText: key,
      metaText,
      audienceAccountId: ctx.user.accountId,
      sortOrder: 0,
    },
  });
  return id;
}

export async function loadAvailabilitySlots(ctx: ProfileCtx): Promise<AvailabilitySlot[]> {
  const rows = await prisma.portalRecord.findMany({
    where: {
      institutionId: ctx.user.institutionId,
      screenPath: AVAILABILITY_PATH,
      role: "instructor",
      audienceAccountId: ctx.user.accountId,
      NOT: { primaryText: { in: ["generalInfo", "officeHours"] } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 80,
  });
  return rows.map((r) => {
    let meta: Partial<AvailabilitySlot> = {};
    try {
      meta = r.metaText ? (JSON.parse(r.metaText) as Partial<AvailabilitySlot>) : {};
    } catch {
      meta = {};
    }
    return {
      id: r.id,
      day: meta.day || r.primaryText || "Weekly",
      start: meta.start || "09:00",
      end: meta.end || "10:00",
      mode: meta.mode || "Office Hours",
      location: meta.location || r.secondaryText || "Campus",
      date: meta.date || "",
      endDate: meta.endDate || "",
      repeats: meta.repeats || "",
      note: meta.note || "",
      title: meta.title || r.secondaryText || "",
    };
  });
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateAvailabilityWindow(input: { start: string; end: string; date: string; endDate: string }) {
  const bad = (msg: string) => Object.assign(new Error(msg), { status: 400, code: "VALIDATION_ERROR" });
  if (!YMD_RE.test(input.date) || Number.isNaN(Date.parse(`${input.date}T12:00:00Z`))) {
    throw bad("Choose a valid date for this availability slot.");
  }
  if (!HM_RE.test(input.start) || !HM_RE.test(input.end)) throw bad("Choose a valid start and end time.");
  if (input.end <= input.start) throw bad("End time must be after the start time.");
  if (input.endDate) {
    if (!YMD_RE.test(input.endDate)) throw bad("Choose a valid end date for the recurrence.");
    if (input.endDate < input.date) throw bad("The recurrence end date cannot be before the start date.");
  }
}

export function availabilityDefaultDates(now = new Date()) {
  const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  return { date: ymd(now), endDate: ymd(end) };
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function normalizeRepeatDays(raw: string, date: string) {
  const picked = new Set(
    raw
      .split(/[·,;|]/)
      .map((d) => d.trim().slice(0, 3).toLowerCase())
      .filter(Boolean),
  );
  const days = WEEKDAY_SHORT.filter((d) => picked.has(d.toLowerCase()));
  if (days.length) return days.join(",");
  return weekdayFromIso(date).slice(0, 3);
}

/** Recurrence is opt-in: a slot only repeats (and only checks its end date) when the recurrence box is ticked. */
export function parseAvailabilityFields(fields: Record<string, string>) {
  const title = (fields["Title / Name (optional)"] || fields["Availability Name"] || fields.Name || "").trim();
  const mode = (fields.Type || fields["Availability Type"] || "Available to Teach").trim();
  const startHour = (fields["Start hour"] || "").trim();
  const startMinute = (fields["Start minute"] || "00").trim();
  const endHour = (fields["End hour"] || "").trim();
  const endMinute = (fields["End minute"] || "00").trim();
  const start =
    (fields["Start Time"] || fields.Start || "").trim() ||
    (startHour ? `${pad2(Number(startHour))}:${pad2(Number(startMinute || 0))}` : "09:00");
  const end =
    (fields["End Time"] || fields.End || "").trim() ||
    (endHour ? `${pad2(Number(endHour))}:${pad2(Number(endMinute || 0))}` : "10:00");
  const date = (fields.Date || "").trim();
  const recurOn = /^(1|true|on|yes)$/i.test((fields["Set availability recurrence timeframe"] || "").trim());
  const endDate = recurOn ? (fields["End Date"] || "").trim() : "";
  const note = (fields.Note || "").trim();
  validateAvailabilityWindow({ start, end, date, endDate });
  const repeats = recurOn
    ? normalizeRepeatDays(fields["Days of the Week"] || fields["Repeat Weekly on"] || fields.Days || "", date)
    : "";
  const location = (fields.Location || title || mode).trim();
  const repeatLabel = repeats.split(",").filter(Boolean).join(" · ");
  const day = repeatLabel || weekdayFromIso(date) || "Weekly";
  return { title, mode, start, end, date, endDate, repeats, note, location, day };
}

export async function persistAvailabilitySlot(ctx: ProfileCtx, fields: Record<string, string>) {
  const { title, mode, start, end, date, endDate, repeats, note, location, day } = parseAvailabilityFields(fields);
  const id = randomUUID();
  await prisma.portalRecord.create({
    data: {
      id,
      institutionId: ctx.user.institutionId,
      screenPath: AVAILABILITY_PATH,
      role: "instructor",
      primaryText: date || day,
      secondaryText: title || mode,
      metaText: JSON.stringify({
        day,
        start,
        end,
        mode,
        location,
        date,
        ...(repeats ? { endDate, repeats } : {}),
        note,
        title,
      }),
      audienceAccountId: ctx.user.accountId,
      sortOrder: 0,
    },
  });
  return { id, day, start, end, mode, location, date, endDate, repeats, note, title };
}

export async function persistConnect(ctx: ProfileCtx, fields: Record<string, string>) {
  const previous = await loadJsonRecord<ConnectPayload>(ctx, PROFILE_BIO_PATH, "connect", { phone: "", email: ctx.person.email });
  const data: ConnectPayload = {
    phone: Object.prototype.hasOwnProperty.call(fields, "Phone") ? fields.Phone!.trim() : previous.phone,
    email: Object.prototype.hasOwnProperty.call(fields, "E-mail") || Object.prototype.hasOwnProperty.call(fields, "Email")
      ? (fields["E-mail"] || fields.Email || "").trim()
      : previous.email,
  };
  await upsertJsonRecord(ctx, PROFILE_BIO_PATH, "connect", data);
  return data;
}

export async function persistEducation(ctx: ProfileCtx, fields: Record<string, string>) {
  const previous = await loadJsonRecord<EducationPayload>(ctx, PROFILE_BIO_PATH, "education", { background: "", experience: "", organizations: "" });
  const data: EducationPayload = {
    background: Object.prototype.hasOwnProperty.call(fields, "Education background") || Object.prototype.hasOwnProperty.call(fields, "Education")
      ? (fields["Education background"] || fields.Education || "").trim()
      : previous.background,
    experience: Object.prototype.hasOwnProperty.call(fields, "Summary of professional experience") || Object.prototype.hasOwnProperty.call(fields, "Experience")
      ? (fields["Summary of professional experience"] || fields.Experience || "").trim()
      : previous.experience,
    organizations: Object.prototype.hasOwnProperty.call(fields, "Membership in professional organizations") || Object.prototype.hasOwnProperty.call(fields, "Organizations")
      ? (fields["Membership in professional organizations"] || fields.Organizations || "").trim()
      : previous.organizations,
  };
  await upsertJsonRecord(ctx, PROFILE_BIO_PATH, "education", data);
  return data;
}

export async function persistProfileDetails(ctx: ProfileCtx, fields: Record<string, string>) {
  const previous = await loadJsonRecord<ProfileDetailsPayload>(ctx, PROFILE_BIO_PATH, "profileDetails", {
    displayName: ctx.displayName,
    preferredName: "",
    pronouns: "",
    office: "",
    department: "Faculty",
    rank: "Instructor",
    yearsTeaching: "",
    hireDate: "",
  });
  const value = (key: string, fallback: string) => Object.prototype.hasOwnProperty.call(fields, key) ? fields[key]!.trim() : fallback;
  const details: ProfileDetailsPayload = {
    displayName: value("Display Name", previous.displayName || ctx.displayName),
    preferredName: value("Preferred Name", previous.preferredName),
    pronouns: value("Pronouns", previous.pronouns),
    office: value("Office", previous.office),
    department: value("Department", previous.department || "Faculty"),
    rank: value("Faculty Rank", previous.rank || "Instructor"),
    yearsTeaching: value("Years Teaching", previous.yearsTeaching),
    hireDate: value("Hire Date", previous.hireDate),
  };
  if (details.yearsTeaching && (!/^\d{1,2}$/.test(details.yearsTeaching) || Number(details.yearsTeaching) > 80)) {
    throw Object.assign(new Error("Years teaching must be between 0 and 80"), { status: 400, code: "VALIDATION_ERROR" });
  }
  if (details.hireDate && !/^\d{4}-\d{2}-\d{2}$/.test(details.hireDate)) {
    throw Object.assign(new Error("Hire date must use YYYY-MM-DD"), { status: 400, code: "VALIDATION_ERROR" });
  }
  await upsertJsonRecord(ctx, PROFILE_BIO_PATH, "profileDetails", details);
  return details;
}

export async function persistGeneralInfo(ctx: ProfileCtx, fields: Record<string, string>) {
  const html = (fields.Content || fields["General Information"] || fields.Body || "").trim();
  await upsertJsonRecord(ctx, AVAILABILITY_PATH, "generalInfo", { html });
  return { html };
}

export async function persistTimezone(ctx: ProfileCtx, fields: Record<string, string>) {
  const zone = (fields["New Time Zone"] || fields.Timezone || "").trim();
  if (!zone) return { timezone: null };
  await prisma.account.update({
    where: { id: ctx.user.accountId },
    data: { timezone: zone },
  });
  return { timezone: zone };
}

export async function loadFacultyAccomplishments(ctx: ProfileCtx) {
  const rows = await prisma.portalRecord.findMany({
    where: {
      institutionId: ctx.user.institutionId,
      screenPath: ACCOMPLISHMENTS_PATH,
      role: "instructor",
      audienceAccountId: ctx.user.accountId,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => {
    let year = "";
    let tone: "success" | "info" | "warning" = "success";
    try {
      const meta = row.metaText ? (JSON.parse(row.metaText) as { year?: string; tone?: string }) : {};
      year = meta.year || "";
      if (meta.tone === "info" || meta.tone === "warning") tone = meta.tone;
    } catch {
      year = "";
    }
    return {
      id: row.id,
      title: row.primaryText,
      detail: row.secondaryText || "",
      year: year || (row.createdAt ? String(row.createdAt.getFullYear()) : "—"),
      tone,
      category: "faculty" as const,
      icon: (() => {
        try {
          const meta = row.metaText ? (JSON.parse(row.metaText) as { icon?: string }) : {};
          return meta.icon || "note";
        } catch {
          return "note";
        }
      })(),
    };
  });
}

export async function persistAccomplishment(ctx: ProfileCtx, fields: Record<string, string>) {
  const title = (fields.Title || fields.Name || "").trim();
  const detail = (fields.Detail || fields.Description || "").trim();
  const year = (fields.Year || String(new Date().getFullYear())).trim();
  if (!title) return { error: true as const, message: "Enter an accomplishment title." };
  const id = randomUUID();
  await prisma.portalRecord.create({
    data: {
      id,
      institutionId: ctx.user.institutionId,
      screenPath: ACCOMPLISHMENTS_PATH,
      role: "instructor",
      primaryText: title,
      secondaryText: detail,
      metaText: JSON.stringify({ year, tone: "success", icon: fields.Icon || "note" }),
      audienceAccountId: ctx.user.accountId,
      href: ACCOMPLISHMENTS_PATH,
      sortOrder: 0,
    },
  });
  return { id, title, detail, year, icon: fields.Icon || "note" };
}

export async function updateAccomplishment(ctx: ProfileCtx, id: string, fields: Record<string, string>) {
  const row = await prisma.portalRecord.findFirst({
    where: { id, institutionId: ctx.user.institutionId, screenPath: ACCOMPLISHMENTS_PATH, role: "instructor", audienceAccountId: ctx.user.accountId },
  });
  if (!row) throw Object.assign(new Error("Faculty record not found"), { status: 404, code: "NOT_FOUND" });
  const title = (fields.Title || row.primaryText).trim();
  if (!title) throw Object.assign(new Error("Enter an accomplishment title"), { status: 400, code: "VALIDATION_ERROR" });
  let previous: { year?: string; tone?: string; icon?: string } = {};
  try { previous = row.metaText ? JSON.parse(row.metaText) as typeof previous : {}; } catch { previous = {}; }
  const detail = Object.prototype.hasOwnProperty.call(fields, "Description") ? fields.Description!.trim() : row.secondaryText || "";
  const meta = {
    year: Object.prototype.hasOwnProperty.call(fields, "Year") ? fields.Year!.trim() : previous.year || "",
    tone: previous.tone || "success",
    icon: Object.prototype.hasOwnProperty.call(fields, "Icon") ? fields.Icon!.trim() : previous.icon || "note",
  };
  await prisma.portalRecord.update({ where: { id: row.id }, data: { primaryText: title, secondaryText: detail, metaText: JSON.stringify(meta), rowVersion: { increment: 1 } } });
  return { id: row.id, title, detail, year: meta.year, icon: meta.icon };
}

function buildTeachingRows(ctx: ProfileCtx) {
  const byCourse = new Map<
    string,
    {
      course: string;
      code: string;
      title: string;
      delivery: string;
      location: string;
      schedule: string;
      days: Set<number>;
      start: Date;
      end: Date;
    }
  >();

  for (const s of ctx.classSessions) {
    const key = `${s.courseCode}::${s.sectionCode}`;
    const end = s.endsAt ?? new Date(s.startsAt.getTime() + 90 * 60 * 1000);
    const existing = byCourse.get(key);
    if (!existing) {
      byCourse.set(key, {
        course: s.courseCode,
        code: s.sectionCode,
        title: ctx.sections.find((x) => x.code === s.sectionCode)?.courseTitle || s.title,
        delivery: s.location?.trim() && (s as { joinUrl?: string | null }).joinUrl ? "Hybrid" : (s as { joinUrl?: string | null }).joinUrl ? "Online" : "In person",
        location: s.location || "TBA",
        schedule: "",
        days: new Set([s.startsAt.getDay()]),
        start: s.startsAt,
        end,
      });
    } else {
      existing.days.add(s.startsAt.getDay());
      if (s.startsAt < existing.start) existing.start = s.startsAt;
      if (end > existing.end) existing.end = end;
      if (s.location && existing.location === "TBA") existing.location = s.location;
      const online = Boolean((s as { joinUrl?: string | null }).joinUrl);
      const inPerson = Boolean(s.location?.trim());
      if ((existing.delivery === "Online" && inPerson) || (existing.delivery === "In person" && online)) existing.delivery = "Hybrid";
    }
  }

  if (byCourse.size === 0) {
    return ctx.sections.map((s) => ({
      course: s.courseCode,
      code: s.code,
      title: s.courseTitle,
      delivery: "Not scheduled",
      location: "—",
      schedule: "No class sessions scheduled",
    }));
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return [...byCourse.values()].map((row) => {
    const days = [...row.days].sort((a, b) => a - b);
    const dayLabel =
      days.length >= 4 && days[0] === 1 && days[days.length - 1] === 4
        ? "Mon-Thu"
        : days.length >= 5 && days[0] === 1 && days[days.length - 1] === 5
          ? "Mon-Fri"
          : days.map((d) => dayNames[d]).join(", ");
    const startIso = row.start.toISOString().slice(0, 10);
    const endIso = row.end.toISOString().slice(0, 10);
    const range =
      startIso === endIso
        ? row.start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : `${row.start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${row.end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    return {
      course: row.course,
      code: row.code,
      title: row.title,
      delivery: row.delivery,
      location: row.location,
      schedule: `${range}\n${dayLabel}, ${formatClock(row.start)} - ${formatClock(row.end)}`,
    };
  });
}

function buildTeachingByDay(ctx: ProfileCtx) {
  const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const buckets = labels.map((day) => ({ day, entries: [] as Array<{ course: string; section: string; time: string }> }));

  const seen = new Set<string>();
  for (const s of ctx.classSessions) {
    const end = s.endsAt ?? new Date(s.startsAt.getTime() + 90 * 60 * 1000);
    const time = `${formatClock(s.startsAt)} - ${formatClock(end)}`;
    const key = `${s.startsAt.getDay()}::${s.courseCode}::${s.sectionCode}::${time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    buckets[s.startsAt.getDay()]!.entries.push({
      course: s.courseCode,
      section: s.sectionCode,
      time,
    });
  }

  if (seen.size === 0) {
    for (const s of ctx.sections) {
      for (const day of [1, 2, 3, 4, 5]) {
        buckets[day]!.entries.push({
          course: s.courseCode,
          section: s.code,
          time: "TBA",
        });
      }
    }
  }

  return buckets.filter((b) => b.entries.length > 0 || (b.day !== "Sunday" && b.day !== "Saturday"));
}

function weekBounds(anchor = new Date()) {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function buildWeekCalendar(ctx: ProfileCtx, slots: AvailabilitySlot[], weekStartIso?: string) {
  const anchor = weekStartIso ? new Date(`${weekStartIso}T12:00:00`) : new Date("2026-09-15T12:00:00");
  const { start, end } = weekBounds(Number.isNaN(anchor.getTime()) ? new Date("2026-09-15T12:00:00") : anchor);
  const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekDays = labels.map((label, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);
    const sessionEntries = ctx.classSessions
      .filter((s) => s.startsAt >= dayStart && s.startsAt <= dayEnd)
      .map((s) => {
        const ends = s.endsAt ?? new Date(s.startsAt.getTime() + 90 * 60 * 1000);
        return {
          kind: "class" as const,
          title: `${s.courseCode} [${s.sectionCode}]`,
          time: `${formatClock(s.startsAt)} - ${formatClock(ends)}`,
          course: s.courseCode,
          section: s.sectionCode,
          location: s.location || "TBA",
          joinUrl: s.joinUrl || undefined,
          sessionTitle: s.title || undefined,
        };
      });
    const slotEntries = slots
      .filter((slot) => {
        if (slot.date === iso) return true;
        if (!slot.repeats) return false;
        if (slot.date && slot.endDate && (iso < slot.date || iso > slot.endDate)) return false;
        const days = slot.repeats.split(/[·,]/).map((x) => x.trim().slice(0, 3).toLowerCase());
        const short = label.slice(0, 3).toLowerCase();
        return days.includes(short);
      })
      .map((slot) => ({
        kind: "availability" as const,
        title: slot.title || slot.mode,
        time: `${slot.start}–${slot.end}`,
        mode: slot.mode,
        location: slot.location || undefined,
        note: slot.note || undefined,
        repeats: slot.repeats || undefined,
      }));
    return {
      label,
      date: iso,
      dateLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      entries: [...sessionEntries, ...slotEntries],
    };
  });

  const weekLabel = `${start.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })} - ${end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  return {
    weekLabel: weekLabel.toUpperCase(),
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
    weekDays,
  };
}

function isoLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function buildScheduleByDate(ctx: ProfileCtx) {
  const sectionHref = new Map(ctx.sections.map((s) => [s.code, `/instructor/sections/${s.id}`]));
  return ctx.classSessions.map((s) => {
    const ends = s.endsAt ?? new Date(s.startsAt.getTime() + 90 * 60 * 1000);
    return {
      date: isoLocal(s.startsAt),
      course: s.courseCode,
      section: s.sectionCode,
      time: `${formatClock(s.startsAt)} - ${formatClock(ends)}`,
      href: sectionHref.get(s.sectionCode) || "/instructor/sections",
    };
  });
}

function buildMonthCalendar(
  slots: AvailabilitySlot[],
  scheduleDates: string[] = [],
  year?: number,
  month?: number,
) {
  const availability = new Set<string>();
  for (const slot of slots) {
    if (slot.date) availability.add(slot.date);
    if (slot.date && slot.endDate && slot.repeats) {
      const cur = new Date(`${slot.date}T12:00:00`);
      const last = new Date(`${slot.endDate}T12:00:00`);
      if (Number.isNaN(cur.getTime()) || Number.isNaN(last.getTime())) continue;
      const days = slot.repeats
        .split(/[·,]/)
        .map((d) => d.trim().slice(0, 3).toLowerCase())
        .filter(Boolean);
      while (cur <= last) {
        const short = cur.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
        if (days.includes(short)) availability.add(isoLocal(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
  }
  const schedule = new Set(scheduleDates.filter(Boolean));
  const markedDates = [...new Set([...availability, ...schedule])].sort();
  const availabilityDates = [...availability].sort();
  const scheduleMarked = [...schedule].sort();
  let focusYear = year;
  let focusMonth = month;
  if (focusYear == null || focusMonth == null) {
    const today = new Date();
    const todayIso = isoLocal(today);
    const focusIso =
      markedDates.find((d) => d >= todayIso) ||
      markedDates[markedDates.length - 1] ||
      slots.find((s) => s.date)?.date ||
      todayIso;
    const focus = new Date(`${focusIso}T12:00:00`);
    focusYear = Number.isNaN(focus.getTime()) ? today.getFullYear() : focus.getFullYear();
    focusMonth = Number.isNaN(focus.getTime()) ? today.getMonth() : focus.getMonth();
  }
  return {
    year: focusYear,
    month: focusMonth, // 0-based
    monthLabel: new Date(focusYear, focusMonth, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    markedDates,
    availabilityDates,
    scheduleDates: scheduleMarked,
  };
}

export function buildAddAvailabilityForm(nameDefault = "", now = new Date()) {
  const defaults = availabilityDefaultDates(now);
  const hours = Array.from({ length: 24 }, (_, i) => ({
    label: pad2(i),
    value: pad2(i),
  }));
  const minutes = ["00", "15", "30", "45"].map((m) => ({ label: m, value: m }));
  return {
    submitLabel: "Save Availability",
    groups: [
      {
        title: "AVAILABILITY",
        fields: [
          { label: "Title / Name (optional)", value: nameDefault, type: "text", optional: true },
          {
            label: "Type",
            value: "Available to Teach",
            type: "select",
            options: AVAILABILITY_TYPES,
          },
          { label: "Start hour", value: "09", type: "select", options: hours },
          { label: "Start minute", value: "00", type: "select", options: minutes },
          { label: "End hour", value: "10", type: "select", options: hours },
          { label: "End minute", value: "00", type: "select", options: minutes },
          { label: "Date", value: defaults.date, type: "date" },
          {
            label: "Set availability recurrence timeframe",
            value: "",
            type: "checkbox",
            optional: true,
          },
          {
            label: "End Date",
            value: "",
            type: "date",
            optional: true,
            visibleWhen: "Set availability recurrence timeframe",
            visibleValue: "true",
          },
          {
            label: "Days of the Week",
            value: weekdayFromIso(defaults.date),
            type: "weekdays",
            optional: true,
            visibleWhen: "Set availability recurrence timeframe",
            visibleValue: "true",
          },
          { label: "Note", value: "", type: "textarea", optional: true },
        ],
      },
    ],
  };
}

export async function buildProfileCompletionPayload(ctx: ProfileCtx) {
  const connect = await loadJsonRecord<ConnectPayload>(ctx, PROFILE_BIO_PATH, "connect", {
    phone: "",
    email: ctx.person.email,
  });
  const education = await loadJsonRecord<EducationPayload>(ctx, PROFILE_BIO_PATH, "education", {
    background: "",
    experience: "",
    organizations: "",
  });
  const details = await loadJsonRecord<ProfileDetailsPayload>(ctx, PROFILE_BIO_PATH, "profileDetails", {
    displayName: ctx.displayName,
    preferredName: "",
    pronouns: "",
    office: "",
    department: "Faculty",
    rank: "Instructor",
    yearsTeaching: "",
    hireDate: "",
  });
  const email = (connect.email || ctx.person.email || "").trim();
  const phone = (connect.phone || "").trim();
  const educationText = [education.background, education.experience, education.organizations]
    .map((v) => (v || "").trim())
    .filter(Boolean)
    .join(" · ");
  const checks = [Boolean((details.displayName || ctx.displayName).trim()), Boolean(email), Boolean(phone), Boolean(educationText)];
  const done = checks.filter(Boolean).length;
  const complete = done === checks.length;
  return {
    title: "Profile Completion",
    subtitle: complete ? "Your faculty profile is complete" : `${done} of ${checks.length} profile details complete`,
    breadcrumbs: ["Home", "My Profile", "Profile Completion"],
    authGate: {
      heading: complete ? "Your profile is complete" : "Complete your faculty profile",
      description: complete
        ? "Students and staff see these details on your faculty profile. You can update them at any time."
        : "Add the missing details below so students and the registrar can reach you.",
      extraFields: [
        { label: "Full Name", value: details.displayName || ctx.displayName },
        { label: "E-mail", value: email },
        { label: "Phone", value: phone || "Not provided" },
        { label: "Education / Accreditation", value: educationText || "Not provided" },
      ],
      fieldLabel: "Course sections assigned",
      fieldValue: ctx.sections.length
        ? ctx.sections.map((s) => `${s.courseCode} ${s.code}`).join(", ")
        : "No course sections are assigned to you yet",
      cta: complete ? "Review Profile" : "Complete Profile",
      ctaHref: `${PROFILE_BIO_PATH}?edit=1`,
      secondaryCta: "Change Password",
      secondaryHref: "/instructor/f/t35-security-settings",
      help: "Need help with your account? Contact the Registrar's Office",
    },
  };
}

export async function buildProfilePayload(
  ctx: ProfileCtx,
  path = "",
  availabilitySlots: AvailabilitySlot[] = [],
) {
  const p = path.toLowerCase();
  const name = ctx.displayName;
  const staffId = ctx.user.personId.slice(0, 8).toUpperCase();
  const initials = `${ctx.person.givenName[0] ?? ""}${ctx.person.familyName[0] ?? ""}`.toUpperCase();
  const currentTermCode = ctx.term?.code;
  const currentSections = currentTermCode
    ? ctx.sections.filter((s) => s.termCode === currentTermCode)
    : ctx.sections;
  const pastSections = currentTermCode
    ? ctx.sections.filter((s) => s.termCode !== currentTermCode)
    : [];
  const courseCodes = [...new Set(currentSections.map((s) => s.courseCode).filter(Boolean))].sort();
  const pastCodes = [...new Set(pastSections.map((s) => s.courseCode).filter(Boolean))].sort();
  const headerTopics = [
    ...new Set([...courseCodes, ...pastCodes].filter(Boolean)),
  ].sort();
  const teachingRows = buildTeachingRows({
    ...ctx,
    sections: currentSections,
    classSessions: ctx.classSessions.filter((s) => currentSections.some((x) => x.code === s.sectionCode)),
  });
  const teachingByDay = buildTeachingByDay({
    ...ctx,
    sections: currentSections,
    classSessions: ctx.classSessions.filter((s) => currentSections.some((x) => x.code === s.sectionCode)),
  });
  const scheduleByDate = buildScheduleByDate({
    ...ctx,
    sections: currentSections,
    classSessions: ctx.classSessions.filter((s) => currentSections.some((x) => x.code === s.sectionCode)),
  });
  const connect = await loadJsonRecord<ConnectPayload>(ctx, PROFILE_BIO_PATH, "connect", {
    phone: "",
    email: ctx.person.email,
  });
  const education = await loadJsonRecord<EducationPayload>(ctx, PROFILE_BIO_PATH, "education", {
    background: "",
    experience: "",
    organizations: "",
  });
  const details = await loadJsonRecord<ProfileDetailsPayload>(ctx, PROFILE_BIO_PATH, "profileDetails", {
    displayName: ctx.displayName,
    preferredName: "",
    pronouns: "",
    office: "",
    department: "Faculty",
    rank: "Instructor",
    yearsTeaching: "",
    hireDate: "",
  });
  const general = await loadJsonRecord<{ html: string }>(ctx, AVAILABILITY_PATH, "generalInfo", {
    html: "",
  });
  const previousCourses = await loadJsonRecord<{ codes: string[] }>(
    ctx,
    PROFILE_TOPICS_PATH,
    "previousCourses",
    { codes: pastCodes },
  );
  const chair = await loadJsonRecord<{ codes: string[] }>(ctx, PROFILE_TOPICS_PATH, "academicChair", {
    codes: headerTopics.length ? headerTopics : courseCodes,
  });
  const previousCodesMerged = [...new Set([...(previousCourses.codes || []), ...pastCodes])].sort();
  const chairCodes = chair.codes.length ? chair.codes : headerTopics;
  const headerBase = profileHeaderPayload(ctx);
  const header = {
    ...headerBase,
    name: details.displayName || headerBase.name,
    topics: chairCodes.length ? chairCodes : headerBase.topics,
    topicLinks: courseTopicLinks(ctx, chairCodes.length ? chairCodes : headerBase.topics),
  };

  if (p.includes("t25") || p.includes("add-availability")) {
    return {
      title: "Add Availability",
      subtitle: "",
      primaryAction: "Save Availability",
      secondaryAction: "Cancel",
      secondaryActionHref: AVAILABILITY_PATH,
      form: buildAddAvailabilityForm(""),
      profileHeader: header,
    };
  }

  if (p.includes("t03") || p.includes("topics")) {
    return {
      title: "Manage My Profile",
      subtitle: "",
      profileHeader: header,
      profileTopics: {
        tabs: profileTabs(PROFILE_TOPICS_PATH),
        teaching: courseCodes,
        currentCourses: courseCodes,
        previousCourses: previousCodesMerged,
        academicChair: chairCodes,
        topicLinks: {
          current: courseTopicLinks(ctx, courseCodes),
          previous: courseTopicLinks(ctx, previousCodesMerged),
          chair: courseTopicLinks(ctx, chairCodes),
        },
        academicLead: "",
        research: [],
        certifications: [],
        teachingSchedule: teachingRows.map((row) => ({
          ...row,
          href:
            courseTopicLinks(ctx, [row.course])[0]?.href ||
            `/instructor/sections`,
        })),
      },
    };
  }

  if (p.includes("t04") || (p.includes("availability") && !p.includes("add-availability"))) {
    const officeFromSlots = availabilitySlots
      .filter((s) => /office/i.test(s.mode))
      .map((s) => {
        const when = s.repeats || s.day;
        const range = s.endDate && s.date && s.date !== s.endDate ? `${s.date} → ${s.endDate}` : s.date || "";
        return `${when}${range ? ` · ${range}` : ""} · ${s.start}–${s.end}`;
      })
      .join("\n");
    const scheduleDates = scheduleByDate.map((s) => s.date);
    return {
      title: "Manage My Profile",
      subtitle: "",
      primaryAction: "Add",
      primaryActionHref: "/instructor/f/t25-add-availability-modal",
      profileHeader: header,
      availability: {
        tabs: profileTabs(AVAILABILITY_PATH),
        slots: availabilitySlots,
        officeHours: officeFromSlots,
        generalInfo: general.html,
        teachingByDay,
        scheduleByDate,
        calendar: buildMonthCalendar(availabilitySlots, scheduleDates),
        note: [
          scheduleByDate.length
            ? `${scheduleByDate.length} teaching session(s) on the calendar.`
            : teachingByDay.length
              ? "Weekly teaching pattern loaded — pick a day to review."
              : null,
          availabilitySlots.length
            ? `${availabilitySlots.length} availability window(s) published.`
            : "Click a day, then Add availability for that date.",
        ]
          .filter(Boolean)
          .join(" "),
      },
    };
  }

  if (p.includes("t05") || p.includes("compensation")) {
    return {
      title: "Manage My Profile",
      subtitle: "",
      profileHeader: header,
      compensation: {
        tabs: profileTabs("/instructor/f/t05-profile-compensation"),
        summary: [],
        payPeriods: [],
        contracts: [],
      },
    };
  }

  if (p.includes("t06") || (p.includes("schedule") && !p.includes("pending"))) {
    const week = buildWeekCalendar(ctx, availabilitySlots);
    return {
      title: "Manage My Profile",
      subtitle: "",
      primaryAction: "Add",
      primaryActionHref: "/instructor/f/t25-add-availability-modal",
      profileHeader: header,
      schedule: {
        tabs: profileTabs(PROFILE_SCHEDULE_PATH),
        teachingByDay,
        ...week,
        weeks: [
          {
            label: week.weekLabel,
            entries: week.weekDays.flatMap((d) =>
              d.entries.map((e) => ({
                day: d.label.slice(0, 3),
                time: e.time,
                course: e.title,
                room: ("location" in e && e.location) || "—",
              })),
            ),
          },
        ],
        emptyMessage: "No availability times were found.",
      },
    };
  }

  if (p.includes("t34") || p.includes("accomplishment")) {
    const facultyItems = await loadFacultyAccomplishments(ctx);
    return {
      title: "My Accomplishments & Badges",
      subtitle: "",
      ...profileHeaderPayload(ctx),
      accomplishments: {
        tabs: profileTabs(ACCOMPLISHMENTS_PATH),
        stats: [
          { label: "Current sections", value: String(ctx.sections.length) },
          { label: "Students", value: String(ctx.studentCount) },
          { label: "Faculty items", value: String(facultyItems.length) },
        ],
        items: facultyItems,
      },
    };
  }

  if (p.includes("t35") || p.includes("security")) {
    return {
      title: "Security Settings",
      subtitle: ctx.person.email,
      security: {
        mfaEnabled: false,
        sessions: [
          {
            device: "Current browser session",
            location: "Campus network",
            lastActive: "Active now",
            current: true,
          },
        ],
        recentActivity: [{ event: "Signed in", when: new Date().toLocaleString() }],
      },
    };
  }

  if (p.includes("t15") || (p.includes("settings") && !p.includes("security"))) {
    const account = await prisma.account.findUnique({ where: { id: ctx.user.accountId } });
    return {
      title: "Change Your Time Zone",
      subtitle: "",
      primaryAction: "Save Time Zone",
      settings: {
        groups: [
          {
            title: "Change your time zone",
            fields: [
              {
                label: "Current Time",
                value: new Date().toLocaleString("en-US", {
                  timeZone: account?.timezone?.includes("/") ? account.timezone : "America/Vancouver",
                }),
              },
              {
                label: "New Time Zone",
                value: account?.timezone || "(UTC-08:00) Pacific Time (US & Canada)",
              },
            ],
          },
        ],
      },
    };
  }

  const educationParts = [education.background, education.experience, education.organizations].filter(Boolean);

  return {
    title: "Manage My Profile",
    subtitle: "Keep your faculty biography and contact details current.",
    primaryAction: "Save Changes",
    secondaryAction: "Cancel",
    profileHeader: header,
    profileBio: {
      name: details.displayName || name,
      role: details.rank || "Instructor",
      department: details.department || "Faculty",
      initials,
      staffId,
      tabs: profileTabs(PROFILE_BIO_PATH),
      personal: [
        { label: "Full Name", value: details.displayName || name },
        { label: "Preferred Name", value: details.preferredName || details.displayName || name },
        { label: "Email", value: connect.email || ctx.person.email },
        { label: "Phone", value: connect.phone || "—" },
        { label: "Office", value: details.office || "—" },
        { label: "Pronouns", value: details.pronouns || "—" },
      ],
      academic: [
        { label: "Highest Degree", value: education.background || "—" },
        { label: "Years Teaching", value: details.yearsTeaching || "—" },
        { label: "Department", value: details.department || "Faculty" },
        { label: "Faculty Rank", value: details.rank || "Instructor" },
        { label: "Hire Date", value: details.hireDate || "—" },
        { label: "Staff ID", value: staffId },
      ],
      expertise: courseCodes,
      bio: educationParts.join("\n\n") || "",
      connect,
      education,
    },
  };
}
