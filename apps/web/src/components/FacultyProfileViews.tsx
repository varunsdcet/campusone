"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TeacherScreenConfig } from "@/lib/teacherCatalog";
import { useOptionalTeacherLive } from "@/lib/useTeacherSisLive";
import { DEFAULT_HCC_TIME_ZONE, HCC_TIME_ZONES } from "@/lib/timeZones";

function PencilButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="mh-hcc-profile__pencil" onClick={onClick} aria-label={label} title={label}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3zM13.5 6.5l3 3"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function ModalShell({
  title,
  section,
  onClose,
  children,
  footer,
}: {
  title: string;
  section?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mh-hcc-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="mh-hcc-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="mh-hcc-modal__panel">
        <header className="mh-hcc-modal__head">
          <h2>{title}</h2>
          <button type="button" className="mh-hcc-modal__x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {section ? <div className="mh-hcc-modal__section">{section}</div> : null}
        <div className="mh-hcc-modal__body">{children}</div>
        {footer ? <div className="mh-hcc-modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

function AvatarZoom({ open, onClose, name }: { open: boolean; onClose: () => void; name: string }) {
  if (!open) return null;
  return (
    <div className="mh-hcc-avatar-zoom" role="dialog" aria-modal="true" aria-label={`${name} profile photo`}>
      <button type="button" className="mh-hcc-avatar-zoom__backdrop" onClick={onClose} aria-label="Close" />
      <div className="mh-hcc-avatar-zoom__card">
        <button type="button" className="mh-hcc-modal__x" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="mh-hcc-avatar-zoom__img" aria-hidden>
          <svg viewBox="0 0 160 160" width="220" height="220">
            <circle cx="80" cy="80" r="80" fill="#e8eef2" />
            <path
              d="M80 28c18 0 32 18 18 36-16 4-20 14-18 22 18 2 36 14 40 32H40c4-18 22-30 40-32 2-8-2-18-18-22-14-18 0-36 18-36z"
              fill="#9aa7b2"
            />
            <path d="M52 118c8-10 18-14 28-14s20 4 28 14" stroke="#9aa7b2" strokeWidth="6" fill="none" />
          </svg>
        </div>
        <p>{name}</p>
      </div>
    </div>
  );
}

export function FacultyProfileLayout({
  config,
  tabs,
  children,
  contentClassName,
  onUpdate,
}: {
  config: TeacherScreenConfig;
  tabs?: Array<{ label: string; href: string; active?: boolean }>;
  children: ReactNode;
  contentClassName?: string;
  onUpdate?: () => void;
}) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const header = config.profileHeader;
  const bio = config.profileBio;
  const name = header?.name || bio?.name || live?.bootstrap?.displayName || "Instructor";
  const status = header?.status || "Active";
  const staffId = bio?.staffId || "INSTRUCTOR";
  const tabItems = tabs?.length ? tabs : bio?.tabs || [];
  const [actionsOpen, setActionsOpen] = useState(false);

  return (
    <div className="mh-ct-profile" data-figma-id={config.figmaId}>
      <p className="mh-ct-profile__crumb">
        Home <span>›</span> My Profile <span>›</span> {name}
      </p>

      <header className="mh-ct-profile__titlebar">
        <div className="mh-ct-profile__title">
          <h1>
            {staffId} - {name}
          </h1>
          <span className="mh-ct-profile__badge">{status}</span>
        </div>
        <div className="mh-ct-profile__actions">
          <div className="mh-ct-profile__actions-menu">
            <button
              type="button"
              className="mh-ct-profile__btn"
              aria-expanded={actionsOpen}
              onClick={() => setActionsOpen((v) => !v)}
            >
              Actions ▾
            </button>
            {actionsOpen ? (
              <div className="mh-ct-profile__actions-drop" role="menu">
                <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); router.push("/instructor/messages"); }}>
                  Message Center
                </button>
                <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); router.push("/instructor/f/t15-settings"); }}>
                  Settings
                </button>
                <button type="button" role="menuitem" onClick={() => { setActionsOpen(false); router.push("/instructor/f/t35-security-settings"); }}>
                  Security
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="mh-ct-profile__btn"
            onClick={() => (onUpdate ? onUpdate() : router.push("/instructor/f/t02-profile-biography?edit=1"))}
          >
            Update
          </button>
          <button type="button" className="mh-ct-profile__btn mh-ct-profile__btn--primary" onClick={() => router.back()}>
            ← Back
          </button>
        </div>
      </header>

      <div className={`mh-ct-profile__card${contentClassName ? ` ${contentClassName}` : ""}`}>
        {tabItems.length ? (
          <nav className="mh-ct-profile__side" aria-label="Profile sections">
            {tabItems.map((t) => (
              <button
                key={t.href}
                type="button"
                className={t.active ? "is-active" : ""}
                onClick={() => router.push(t.href)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        ) : null}
        <div className="mh-ct-profile__content">{children}</div>
      </div>
    </div>
  );
}

export function ProfileBioView({ config }: { config: TeacherScreenConfig }) {
  const live = useOptionalTeacherLive();
  const p = config.profileBio;
  const connect = p?.connect;
  const education = p?.education;
  const email = connect?.email || config.profileHeader?.email || p?.personal?.find((f) => f.label === "Email")?.value || "";
  const phone = connect?.phone || p?.personal?.find((f) => f.label === "Phone")?.value || "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const [modal, setModal] = useState<"connect" | "education" | "profile" | null>(
    searchParams.get("edit") === "1" ? "profile" : null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [phoneVal, setPhoneVal] = useState(phone === "—" ? "" : phone);
  const [emailVal, setEmailVal] = useState(email);
  const [eduBg, setEduBg] = useState(education?.background || "");
  const [eduExp, setEduExp] = useState(education?.experience || "");
  const [eduOrg, setEduOrg] = useState(education?.organizations || "");

  useEffect(() => {
    setPhoneVal(phone === "—" ? "" : phone);
    setEmailVal(email);
    setEduBg(education?.background || "");
    setEduExp(education?.experience || "");
    setEduOrg(education?.organizations || "");
  }, [phone, email, education?.background, education?.experience, education?.organizations]);

  async function saveConnect(e: FormEvent) {
    e.preventDefault();
    await live?.runAction(
      "Save Content",
      JSON.stringify({ __kind: "connect", Phone: phoneVal, "E-mail": emailVal }),
    );
    setModal(null);
    await live?.refresh();
  }

  async function saveEducation(e: FormEvent) {
    e.preventDefault();
    await live?.runAction(
      "Save Content",
      JSON.stringify({
        __kind: "education",
        "Education background": eduBg,
        "Summary of professional experience": eduExp,
        "Membership in professional organizations": eduOrg,
      }),
    );
    setModal(null);
    await live?.refresh();
  }

  function closeModal() {
    setModal(null);
    setSaveError(null);
    if (searchParams.get("edit")) router.replace("/instructor/f/t02-profile-biography");
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    const okConnect = await live?.runAction(
      "Save Content",
      JSON.stringify({ __kind: "connect", Phone: phoneVal, "E-mail": emailVal }),
    );
    const okEducation =
      okConnect &&
      (await live?.runAction(
        "Save Content",
        JSON.stringify({
          __kind: "education",
          "Education background": eduBg,
          "Summary of professional experience": eduExp,
          "Membership in professional organizations": eduOrg,
        }),
      ));
    if (!okConnect || !okEducation) {
      setSaveError("Your profile could not be saved. Check the fields and try again.");
      return;
    }
    closeModal();
    await live?.refresh();
  }

  const personal = p?.personal || [];
  const academic = p?.academic || [];
  const val = (label: string, fallback = "—") =>
    personal.find((f) => f.label === label)?.value ||
    academic.find((f) => f.label === label)?.value ||
    fallback;

  const infoRows: Array<[string, string, string, string]> = [
    ["Staff ID", p?.staffId || val("Staff ID"), "Full Name", val("Full Name", p?.name || "—")],
    ["Email", email || "—", "Phone", phone && phone !== "—" ? phone : "—"],
    ["Preferred Name", val("Preferred Name"), "Pronouns", val("Pronouns")],
    ["Office", val("Office"), "Department", val("Department", p?.department || "—")],
  ];

  const otherRows: Array<[string, string, string, string]> = [
    ["Faculty Rank", val("Faculty Rank", p?.role || "Instructor"), "Highest Degree", val("Highest Degree")],
    ["Years Teaching", val("Years Teaching"), "Hire Date", val("Hire Date")],
  ];

  return (
    <FacultyProfileLayout config={config} tabs={p?.tabs} onUpdate={() => setModal("profile")}>
      <section className="mh-ct-profile__block">
        <h2>Teacher Information</h2>
        <div className="mh-ct-profile__info">
          <div className="mh-ct-profile__identity">
            <button
              type="button"
              className="mh-ct-profile__avatar"
              onClick={() => setZoom(true)}
              aria-label="Zoom profile photo"
            >
              <svg viewBox="0 0 64 64" width="96" height="96">
                <circle cx="32" cy="32" r="32" fill="#e8eef2" />
                <path
                  d="M32 12c8 0 14 8 8 16-7 2-9 6-8 10 8 1 16 6 18 14H14c2-8 10-13 18-14 1-4-1-8-8-10-6-8 0-16 8-16z"
                  fill="#9aa7b2"
                />
              </svg>
              <span className="mh-ct-profile__avatar-edit" aria-hidden>
                ✎
              </span>
            </button>
            <strong>{p?.name || "Instructor"}</strong>
            <span>{p?.role || "Teacher"}</span>
            <div className="mh-ct-profile__identity-actions">
              <PencilButton onClick={() => setModal("connect")} label="Edit connect" />
              <PencilButton onClick={() => setModal("education")} label="Edit education" />
            </div>
          </div>
          <table className="mh-ct-profile__table">
            <tbody>
              {infoRows.map((row, i) => (
                <tr key={i}>
                  <th>{row[0]}</th>
                  <td>{row[1]}</td>
                  <th>{row[2]}</th>
                  <td>{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mh-ct-profile__block">
        <h2>Other Information</h2>
        <table className="mh-ct-profile__table">
          <tbody>
            {otherRows.map((row, i) => (
              <tr key={i}>
                <th>{row[0]}</th>
                <td>{row[1]}</td>
                <th>{row[2]}</th>
                <td>{row[3]}</td>
              </tr>
            ))}
            {education?.background || education?.experience || education?.organizations ? (
              <tr>
                <th>Education / Accreditation</th>
                <td colSpan={3} className="mh-ct-profile__pre">
                  {[education?.background, education?.experience, education?.organizations]
                    .filter(Boolean)
                    .join("\n\n")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <AvatarZoom open={zoom} onClose={() => setZoom(false)} name={p?.name || "Instructor"} />

      {modal === "profile" ? (
        <ModalShell
          title="UPDATE PROFILE"
          section="CONTACT AND EDUCATION"
          onClose={closeModal}
          footer={
            <button type="submit" form="profile-form" className="mh-hcc-modal__save" disabled={live?.busy}>
              {live?.busy ? "Saving…" : "Save Profile"}
            </button>
          }
        >
          <form id="profile-form" className="mh-hcc-modal__form" onSubmit={saveProfile}>
            {saveError ? (
              <p className="mh-teacher-muted" role="alert">
                {saveError}
              </p>
            ) : null}
            <label>
              <span>Phone</span>
              <input value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} />
            </label>
            <label>
              <span>E-mail</span>
              <input value={emailVal} onChange={(e) => setEmailVal(e.target.value)} type="email" required />
            </label>
            <label>
              <span>Education background</span>
              <textarea rows={3} value={eduBg} onChange={(e) => setEduBg(e.target.value)} />
            </label>
            <label>
              <span>Summary of professional experience</span>
              <textarea rows={3} value={eduExp} onChange={(e) => setEduExp(e.target.value)} />
            </label>
            <label>
              <span>Membership in professional organizations</span>
              <textarea rows={3} value={eduOrg} onChange={(e) => setEduOrg(e.target.value)} />
            </label>
          </form>
        </ModalShell>
      ) : null}

      {modal === "connect" ? (
        <ModalShell
          title="CONNECT"
          section="CONTENT"
          onClose={() => setModal(null)}
          footer={
            <button type="submit" form="connect-form" className="mh-hcc-modal__save">
              Save Content
            </button>
          }
        >
          <form id="connect-form" className="mh-hcc-modal__form" onSubmit={saveConnect}>
            <label>
              <span>Phone</span>
              <input value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} />
            </label>
            <label>
              <span>E-mail</span>
              <input value={emailVal} onChange={(e) => setEmailVal(e.target.value)} type="email" required />
            </label>
          </form>
        </ModalShell>
      ) : null}

      {modal === "education" ? (
        <ModalShell
          title="EDUCATION / ACCREDITATION"
          section="CONTENT"
          onClose={() => setModal(null)}
          footer={
            <button type="submit" form="edu-form" className="mh-hcc-modal__save">
              Save Content
            </button>
          }
        >
          <form id="edu-form" className="mh-hcc-modal__form" onSubmit={saveEducation}>
            <label>
              <span>Education background</span>
              <textarea rows={4} value={eduBg} onChange={(e) => setEduBg(e.target.value)} />
            </label>
            <label>
              <span>Summary of professional experience</span>
              <textarea rows={4} value={eduExp} onChange={(e) => setEduExp(e.target.value)} />
            </label>
            <label>
              <span>Membership in professional organizations</span>
              <textarea rows={4} value={eduOrg} onChange={(e) => setEduOrg(e.target.value)} />
            </label>
          </form>
        </ModalShell>
      ) : null}
    </FacultyProfileLayout>
  );
}

export function ProfileTopicsView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const p = config.profileTopics;
  const current = p?.topicLinks?.current?.length
    ? p.topicLinks.current
    : (p?.currentCourses?.length ? p.currentCourses : p?.teaching ?? []).map((label) => ({
        label,
        href: "/instructor/sections",
      }));
  const previous = p?.topicLinks?.previous?.length
    ? p.topicLinks.previous
    : (p?.previousCourses ?? []).map((label) => ({ label, href: "/instructor/sections" }));
  const chair = p?.topicLinks?.chair?.length
    ? p.topicLinks.chair
    : (p?.academicChair ?? []).map((label) => ({ label, href: "/instructor/sections" }));
  const schedule = p?.teachingSchedule ?? [];

  return (
    <FacultyProfileLayout config={config} tabs={p?.tabs}>
      <div className="mh-hcc-profile__split mh-hcc-profile__split--topics">
        <aside>
          <section>
            <h2>CURRENT COURSES</h2>
            {current.length ? (
              <ul className="mh-hcc-profile__list">
                {current.map((t) => (
                  <li key={t.label}>
                    <button
                      type="button"
                      className="mh-hcc-profile__topic-link"
                      onClick={() => router.push(t.href)}
                    >
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mh-teacher-muted">No current courses.</p>
            )}
          </section>
          <section>
            <h2>PREVIOUS COURSES TAUGHT</h2>
            {previous.length ? (
              <ul className="mh-hcc-profile__list">
                {previous.map((t) => (
                  <li key={t.label}>
                    <button
                      type="button"
                      className="mh-hcc-profile__topic-link"
                      onClick={() => router.push(t.href)}
                    >
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mh-teacher-muted">No previous courses.</p>
            )}
          </section>
        </aside>
        <div>
          <section>
            <h2>ACADEMIC CHAIR</h2>
            {chair.length ? (
              <>
                <p className="mh-hcc-profile__subhead">Topics</p>
                <p className="mh-hcc-profile__topics-block">
                  •{" "}
                  {chair.map((t, i) => (
                    <span key={t.label}>
                      <button
                        type="button"
                        className="mh-hcc-profile__topic-link"
                        onClick={() => router.push(t.href)}
                      >
                        {t.label}
                      </button>
                      {i < chair.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              </>
            ) : (
              <p className="mh-teacher-muted">No content available.</p>
            )}
          </section>
          <section>
            <h2>ACADEMIC LEAD</h2>
            <p className="mh-teacher-muted">{p?.academicLead || "No content available."}</p>
          </section>
          <section>
            <h2>CURRENT TEACHING SCHEDULE</h2>
            <table className="mh-hcc-profile__table">
              <thead>
                <tr>
                  <th>COURSE</th>
                  <th>DELIVERY METHOD</th>
                  <th>LOCATION</th>
                  <th>SCHEDULE</th>
                </tr>
              </thead>
              <tbody>
                {schedule.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No content available.</td>
                  </tr>
                ) : (
                  schedule.map((row) => (
                    <tr key={`${row.code}-${row.course}`}>
                      <td>
                        <button
                          type="button"
                          className="mh-hcc-profile__topic-link mh-hcc-profile__topic-link--block"
                          onClick={() => router.push(row.href || "/instructor/sections")}
                        >
                          <strong>
                            {row.course} ({row.code})
                          </strong>
                        </button>
                        <br />
                        {row.title}
                      </td>
                      <td>{row.delivery}</td>
                      <td>{row.location}</td>
                      <td className="mh-hcc-profile__pre">{row.schedule}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </FacultyProfileLayout>
  );
}

function formatClockLabel(hhmm: string) {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw || 0);
  if (Number.isNaN(h)) return hhmm;
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "");
}

function slotOccursOnDate(
  slot: {
    date?: string;
    endDate?: string;
    repeats?: string;
    day?: string;
  },
  iso: string,
) {
  if (!iso) return false;
  if (slot.date === iso) return true;
  const repeats = (slot.repeats || "").trim();
  if (!repeats) {
    // Non-recurring: also match weekday label stored in day when date missing
    if (!slot.date && slot.day) {
      const weekday = new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
      return slot.day.toLowerCase() === weekday.toLowerCase() || slot.day.slice(0, 3).toLowerCase() === weekday.slice(0, 3).toLowerCase();
    }
    return false;
  }
  if (slot.date && iso < slot.date) return false;
  if (slot.endDate && iso > slot.endDate) return false;
  if (slot.date && !slot.endDate && slot.date !== iso) {
    // Recurring without end date: treat as weekly from start date forward
    if (iso < slot.date) return false;
  }
  const day = new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
  const days = repeats.split(/[·,;/|\s]+/).map((x) => x.trim().slice(0, 3).toLowerCase()).filter(Boolean);
  return days.includes(day);
}

function focusIsoFromSlot(slot: { date?: string; endDate?: string; repeats?: string }) {
  if (slot.date) return slot.date;
  return null;
}

function AvailabilityDetailModal({
  slot,
  onClose,
  onFocusDay,
}: {
  slot: {
    id?: string;
    day: string;
    start: string;
    end: string;
    mode: string;
    location: string;
    date?: string;
    repeats?: string;
    endDate?: string;
    note?: string;
    title?: string;
  };
  onClose: () => void;
  onFocusDay: (iso: string) => void;
}) {
  const range =
    slot.date && slot.endDate && slot.endDate !== slot.date
      ? `${slot.date} → ${slot.endDate}`
      : slot.date || "—";
  return (
    <ModalShell
      title={slot.title || slot.mode || "Availability"}
      section="DETAILS"
      onClose={onClose}
      footer={
        slot.date ? (
          <button
            type="button"
            className="mh-hcc-modal__save"
            onClick={() => {
              onFocusDay(slot.date!);
              onClose();
            }}
          >
            Show on calendar
          </button>
        ) : (
          <button type="button" className="mh-hcc-modal__save" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      <dl className="mh-hcc-avail__detail">
        <div>
          <dt>Type</dt>
          <dd>{slot.mode}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>
            {formatClockLabel(slot.start)}–{formatClockLabel(slot.end)}
          </dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{range}</dd>
        </div>
        <div>
          <dt>Repeats</dt>
          <dd>{slot.repeats || slot.day || "Does not repeat"}</dd>
        </div>
        {slot.location ? (
          <div>
            <dt>Location</dt>
            <dd>{slot.location}</dd>
          </div>
        ) : null}
        {slot.note ? (
          <div>
            <dt>Note</dt>
            <dd className="mh-hcc-profile__pre">{slot.note}</dd>
          </div>
        ) : null}
      </dl>
    </ModalShell>
  );
}

function expandAvailabilityMarks(
  slots: Array<{
    date?: string;
    endDate?: string;
    repeats?: string;
  }>,
): string[] {
  const marked = new Set<string>();
  for (const slot of slots) {
    if (slot.date) marked.add(slot.date);
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
        if (days.includes(short)) {
          marked.add(
            `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`,
          );
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
  }
  return [...marked].sort();
}

function MonthCalendar({
  year,
  month,
  markedDates,
  availabilityDates,
  scheduleDates,
  selectedIso,
  onSelect,
  onPrev,
  onNext,
}: {
  year: number;
  month: number;
  markedDates: string[];
  availabilityDates?: string[];
  scheduleDates?: string[];
  selectedIso?: string | null;
  onSelect?: (iso: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const marked = new Set(markedDates);
  const avail = new Set(availabilityDates?.length ? availabilityDates : markedDates);
  const sched = new Set(scheduleDates ?? []);
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const label = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const prevLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short" });
  const nextLabel = new Date(year, month + 1, 1).toLocaleDateString("en-US", { month: "short" });
  const cells: Array<{ day: number | null; iso: string }> = [];
  for (let i = 0; i < startPad; i++) cells.push({ day: null, iso: "" });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, iso });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: "" });

  return (
    <div className="mh-hcc-cal">
      <div className="mh-hcc-cal__nav">
        <button type="button" onClick={onPrev} aria-label={`Previous month, ${prevLabel}`}>
          ← {prevLabel}
        </button>
        <strong>{label}</strong>
        <button type="button" onClick={onNext} aria-label={`Next month, ${nextLabel}`}>
          {nextLabel} →
        </button>
      </div>
      <div className="mh-hcc-cal__head">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="mh-hcc-cal__dow">
            {d}
          </div>
        ))}
      </div>
      <div className="mh-hcc-cal__grid">
        {cells.map((c, idx) => {
          const hasAvail = Boolean(c.iso && avail.has(c.iso));
          const hasSched = Boolean(c.iso && sched.has(c.iso));
          const isMarked = Boolean(c.iso && marked.has(c.iso)) || hasAvail || hasSched;
          const isSelected = Boolean(c.iso && selectedIso === c.iso);
          const className = [
            "mh-hcc-cal__cell",
            c.day ? "" : "is-empty",
            isMarked ? "is-marked" : "",
            hasSched ? "is-teaching" : "",
            hasAvail ? "is-avail" : "",
            isSelected ? "is-selected" : "",
          ]
            .filter(Boolean)
            .join(" ");
          if (!c.day) {
            return <div key={idx} className={className} />;
          }
          return (
            <button
              key={idx}
              type="button"
              className={className}
              onClick={() => onSelect?.(c.iso)}
              aria-pressed={isSelected}
              aria-label={`${label} ${c.day}${hasSched ? ", teaching" : ""}${hasAvail ? ", availability" : ""}`}
            >
              <span>{c.day}</span>
              {(hasSched || hasAvail) && (
                <span className="mh-hcc-cal__marks" aria-hidden>
                  {hasSched ? <i className="mh-hcc-cal__dot mh-hcc-cal__dot--teach" /> : null}
                  {hasAvail ? <i className="mh-hcc-cal__dot mh-hcc-cal__dot--avail" /> : null}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mh-hcc-cal__legend">
        <i className="mh-hcc-cal__dot mh-hcc-cal__dot--teach" aria-hidden /> Teaching{" "}
        <i className="mh-hcc-cal__dot mh-hcc-cal__dot--avail" aria-hidden /> Availability — click a day to
        review or add
      </p>
    </div>
  );
}

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AvailabilityModal({
  open,
  onClose,
  onSaved,
  defaultType = "Available to Teach",
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  defaultType?: string;
  defaultDate?: string | null;
}) {
  const live = useOptionalTeacherLive();
  const [title, setTitle] = useState("");
  const [type, setType] = useState(defaultType);
  const [startH, setStartH] = useState("09");
  const [startM, setStartM] = useState("00");
  const [endH, setEndH] = useState("10");
  const [endM, setEndM] = useState("00");
  const [date, setDate] = useState(() => defaultDate || isoDay(new Date()));
  const [recur, setRecur] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [days, setDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(defaultType);
    setError("");
    setDate(defaultDate || isoDay(new Date()));
    setRecur(false);
    setEndDate("");
  }, [open, defaultType, defaultDate]);

  if (!open) return null;

  const startTime = `${startH}:${startM}`;
  const endTime = `${endH}:${endM}`;
  const problem = !date
    ? "Choose a date."
    : endTime <= startTime
      ? "End time must be after the start time."
      : recur && endDate && endDate < date
        ? "The recurrence end date cannot be before the start date."
        : recur && days.length === 0
          ? "Pick at least one day of the week."
          : "";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const ok = await live?.runAction(
        "Save Availability",
        JSON.stringify({
          "Title / Name (optional)": title,
          Type: type,
          "Start hour": startH,
          "Start minute": startM,
          "End hour": endH,
          "End minute": endM,
          Date: date,
          "Set availability recurrence timeframe": recur ? "1" : "",
          "End Date": recur ? endDate : "",
          "Days of the Week": recur ? days.join(",") : "",
          Note: note,
        }),
      );
      if (ok === false) {
        setError("Availability could not be saved. Check the date and times, then try again.");
        return;
      }
      onClose();
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const mins = ["00", "15", "30", "45"];
  const week = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <ModalShell
      title="AVAILABILITY"
      section="AVAILABILITY"
      onClose={onClose}
      footer={
        <button type="submit" form="avail-form" className="mh-hcc-modal__save" disabled={saving}>
          {saving ? "Saving…" : "Save Availability"}
        </button>
      }
    >
      <form id="avail-form" className="mh-hcc-modal__form" onSubmit={onSubmit}>
        <label>
          <span>Title / Name (optional)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option>Available to Teach</option>
            <option>Office Hours</option>
          </select>
        </label>
        <div className="mh-hcc-modal__times">
          <label>
            <span>Start</span>
            <span className="mh-hcc-modal__timepair">
              <select value={startH} onChange={(e) => setStartH(e.target.value)}>
                {hours.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
              <select value={startM} onChange={(e) => setStartM(e.target.value)}>
                {mins.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </span>
          </label>
          <label>
            <span>End</span>
            <span className="mh-hcc-modal__timepair">
              <select value={endH} onChange={(e) => setEndH(e.target.value)}>
                {hours.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
              <select value={endM} onChange={(e) => setEndM(e.target.value)}>
                {mins.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </span>
          </label>
        </div>
        <label>
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="mh-hcc-modal__check">
          <input type="checkbox" checked={recur} onChange={(e) => setRecur(e.target.checked)} />
          <span>Set availability recurrence timeframe</span>
        </label>
        {recur ? (
          <label>
            <span>End Date</span>
            <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        ) : null}
        {recur ? (
          <fieldset className="mh-hcc-modal__days">
            <legend>Days of the Week</legend>
            {week.map((d) => (
              <label key={d}>
                <input
                  type="checkbox"
                  checked={days.includes(d)}
                  onChange={(e) =>
                    setDays((prev) => (e.target.checked ? [...prev, d] : prev.filter((x) => x !== d)))
                  }
                />
                {d}
              </label>
            ))}
          </fieldset>
        ) : null}
        <label>
          <span>Note</span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error || problem ? (
          <p className="mh-teacher-muted" role="alert">
            {error || problem}
          </p>
        ) : null}
      </form>
    </ModalShell>
  );
}

export function AvailabilityView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const a = config.availability;
  const cal = a?.calendar;
  const slots = a?.slots ?? [];
  const [year, setYear] = useState(cal?.year ?? 2026);
  const [month, setMonth] = useState(cal?.month ?? 8);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState("Available to Teach");
  const [generalOpen, setGeneralOpen] = useState(false);
  const [generalHtml, setGeneralHtml] = useState(a?.generalInfo || "");
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);
  const [detailSlotKey, setDetailSlotKey] = useState<string | null>(null);
  const prevSlotCount = useRef(slots.length);
  const teachingByDay = a?.teachingByDay ?? [];
  const scheduleByDate = a?.scheduleByDate ?? [];

  function slotKey(slot: (typeof slots)[number], i: number) {
    return slot.id || `${slot.date || slot.day}-${slot.start}-${slot.end}-${slot.mode}-${i}`;
  }

  function focusSlot(slot: (typeof slots)[number], i: number, openDetail = false) {
    const key = slotKey(slot, i);
    setSelectedSlotKey(key);
    const iso = focusIsoFromSlot(slot);
    if (iso) {
      const [y, m] = iso.split("-").map(Number);
      if (y && m) {
        setYear(y);
        setMonth(m - 1);
      }
      setSelectedIso(iso);
    } else if (slot.repeats || slot.day) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const isoTry = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (slotOccursOnDate(slot, isoTry)) {
          setSelectedIso(isoTry);
          break;
        }
      }
    }
    if (openDetail) setDetailSlotKey(key);
  }

  useEffect(() => {
    if (slots.length > prevSlotCount.current && slots[0]) {
      focusSlot(slots[0], 0, true);
    }
    prevSlotCount.current = slots.length;
  }, [slots]);

  const scheduleDates = useMemo(() => {
    const fromApi = a?.calendar?.scheduleDates ?? [];
    if (fromApi.length) return fromApi;
    const fromSessions = [...new Set(scheduleByDate.map((s) => s.date))].sort();
    if (fromSessions.length) return fromSessions;
    // Fall back: paint weekly teaching pattern onto the visible month
    const teachDays = new Set(teachingByDay.filter((d) => d.entries.length).map((d) => d.day));
    if (!teachDays.size) return [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const label = date.toLocaleDateString("en-US", { weekday: "long" });
      if (!teachDays.has(label)) continue;
      out.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    return out;
  }, [a?.calendar?.scheduleDates, scheduleByDate, teachingByDay, year, month]);

  const availabilityDates = useMemo(() => {
    const fromApi = a?.calendar?.availabilityDates ?? [];
    if (fromApi.length) return fromApi;
    return expandAvailabilityMarks(slots);
  }, [a?.calendar?.availabilityDates, slots]);

  const markedDates = useMemo(() => {
    const fromApi = a?.calendar?.markedDates ?? [];
    if (fromApi.length) return fromApi;
    return [...new Set([...availabilityDates, ...scheduleDates])].sort();
  }, [a?.calendar?.markedDates, availabilityDates, scheduleDates]);

  useEffect(() => {
    if (cal) {
      setYear(cal.year);
      setMonth(cal.month);
    }
  }, [cal?.year, cal?.month]);

  useEffect(() => {
    setGeneralHtml(a?.generalInfo || "");
  }, [a?.generalInfo]);

  useEffect(() => {
    setSelectedIso((prev) => {
      if (prev) return prev;
      const inMonth = markedDates.find((iso) => {
        const [y, m] = iso.split("-").map(Number);
        return y === year && m === month + 1;
      });
      if (inMonth) return inMonth;
      if (markedDates[0]) return markedDates[0];
      return `${year}-${String(month + 1).padStart(2, "0")}-01`;
    });
  }, [markedDates, year, month]);

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function openAdd(type = "Available to Teach") {
    setAddType(type);
    setAddOpen(true);
  }

  async function saveGeneral(e: FormEvent) {
    e.preventDefault();
    await live?.runAction(
      "Save Content",
      JSON.stringify({ __kind: "general", Content: generalHtml }),
    );
    setGeneralOpen(false);
    await live?.refresh();
  }

  const words = generalHtml.trim() ? generalHtml.trim().split(/\s+/).length : 0;
  const officeHoursText = (a?.officeHours || "").trim();
  const selectedSlots = useMemo(() => {
    if (!selectedIso) return [];
    return slots
      .map((slot, i) => ({ slot, i, key: slotKey(slot, i) }))
      .filter(({ slot }) => slotOccursOnDate(slot, selectedIso));
  }, [slots, selectedIso]);

  const selectedTeaching = useMemo(() => {
    if (!selectedIso) return [];
    const dated = scheduleByDate.filter((s) => s.date === selectedIso);
    if (dated.length) return dated;
    const weekday = new Date(`${selectedIso}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
    const pattern = teachingByDay.find((d) => d.day === weekday);
    return (pattern?.entries ?? []).map((e) => ({
      date: selectedIso,
      course: e.course,
      section: e.section,
      time: e.time,
      href: "/instructor/sections",
      recurring: true as const,
    }));
  }, [selectedIso, scheduleByDate, teachingByDay]);

  const detailSlot = useMemo(() => {
    if (!detailSlotKey) return null;
    return slots.find((slot, i) => slotKey(slot, i) === detailSlotKey) || null;
  }, [detailSlotKey, slots]);

  const selectedLabel = selectedIso
    ? new Date(`${selectedIso}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <FacultyProfileLayout config={config} tabs={a?.tabs}>
      <div className="mh-hcc-avail">
        <div className="mh-hcc-avail__cards">
          <section className="mh-hcc-avail__card">
            <div className="mh-hcc-profile__card-head">
              <h2>REGULAR OFFICE HOURS</h2>
              <PencilButton onClick={() => openAdd("Office Hours")} label="Add office hours" />
            </div>
            {officeHoursText ? (
              <p className="mh-hcc-avail__pre">{officeHoursText}</p>
            ) : (
              <p className="mh-teacher-muted">No office hours published yet.</p>
            )}
          </section>
          <section className="mh-hcc-avail__card">
            <div className="mh-hcc-profile__card-head">
              <h2>GENERAL INFORMATION</h2>
              <PencilButton onClick={() => setGeneralOpen(true)} label="Edit general information" />
            </div>
            {a?.generalInfo ? (
              <div className="mh-hcc-profile__rich" dangerouslySetInnerHTML={{ __html: a.generalInfo }} />
            ) : (
              <p className="mh-teacher-muted">No content available.</p>
            )}
          </section>
        </div>

        <section className="mh-hcc-avail__main">
          <div className="mh-hcc-avail__main-head">
            <div>
              <h2>AVAILABILITY</h2>
              <p className="mh-hcc-avail__note">
                {a?.note ||
                  (slots.length
                    ? `${slots.length} window(s) — click a card or day row for full details.`
                    : "Pick a day on the calendar to review teaching and add availability.")}
              </p>
            </div>
            <button type="button" className="mh-hcc-avail__add" onClick={() => openAdd("Available to Teach")}>
              + Add
            </button>
          </div>

          {slots.length ? (
            <ul className="mh-hcc-avail__slots">
              {slots.map((slot, i) => {
                const key = slotKey(slot, i);
                const active = selectedSlotKey === key;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={`mh-hcc-avail__slot${active ? " is-active" : ""}`}
                      onClick={() => focusSlot(slot, i, true)}
                    >
                      <div className="mh-hcc-avail__slot-top">
                        <strong>{slot.title || slot.mode}</strong>
                        <span className="mh-hcc-avail__pill">{slot.mode}</span>
                      </div>
                      <p>
                        {formatClockLabel(slot.start)}–{formatClockLabel(slot.end)}
                        {slot.date ? ` · ${slot.date}` : ""}
                        {slot.endDate && slot.endDate !== slot.date ? ` → ${slot.endDate}` : ""}
                      </p>
                      <p className="mh-hcc-avail__slot-meta">
                        {slot.repeats || slot.day}
                        {slot.note ? ` · ${slot.note}` : ""}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="mh-hcc-avail__grid">
            <div className="mh-hcc-avail__side">
              <h3>CURRENT TEACHING SCHEDULE</h3>
              {teachingByDay.length === 0 ? (
                <p className="mh-teacher-muted">No content available.</p>
              ) : (
                teachingByDay.map((day) => (
                  <div key={day.day} className="mh-hcc-profile__dayblock">
                    <strong>{day.day}</strong>
                    {day.entries.map((e) => (
                      <p key={`${e.course}-${e.section}-${e.time}`}>
                        {e.course} ({e.section}) — {e.time}
                      </p>
                    ))}
                  </div>
                ))
              )}
            </div>

            <div className="mh-hcc-avail__calwrap">
              <MonthCalendar
                year={year}
                month={month}
                markedDates={markedDates}
                availabilityDates={availabilityDates}
                scheduleDates={scheduleDates}
                selectedIso={selectedIso}
                onSelect={(iso) => {
                  setSelectedIso(iso);
                  setSelectedSlotKey(null);
                }}
                onPrev={() => shiftMonth(-1)}
                onNext={() => shiftMonth(1)}
              />
              <div className="mh-hcc-avail__daydetail">
                <div className="mh-hcc-avail__daydetail-head">
                  <h3>{selectedLabel || "Select a day"}</h3>
                  {selectedIso ? (
                    <button
                      type="button"
                      className="mh-hcc-avail__day-cta"
                      onClick={() => openAdd("Available to Teach")}
                    >
                      + Add for this day
                    </button>
                  ) : null}
                </div>

                {selectedTeaching.length > 0 ? (
                  <div className="mh-hcc-avail__daysection">
                    <p className="mh-hcc-avail__daysection-label">Teaching</p>
                    {selectedTeaching.map((row, i) => (
                      <button
                        key={`teach-${row.course}-${row.section}-${row.time}-${i}`}
                        type="button"
                        className="mh-hcc-avail__dayitem mh-hcc-avail__dayitem--link"
                        onClick={() => router.push(row.href || "/instructor/sections")}
                      >
                        <strong>
                          {row.course} ({row.section})
                          {"recurring" in row && row.recurring ? (
                            <span className="mh-hcc-avail__soft"> · weekly pattern</span>
                          ) : null}
                        </strong>
                        <span>{row.time}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mh-hcc-avail__daysection">
                  <p className="mh-hcc-avail__daysection-label">Availability</p>
                  {selectedSlots.length === 0 ? (
                    <p className="mh-teacher-muted">
                      No availability window on this day. Use <strong>Add for this day</strong> to publish
                      office hours or teaching availability.
                    </p>
                  ) : (
                    selectedSlots.map(({ slot, i, key }) => (
                      <button
                        key={key}
                        type="button"
                        className={`mh-hcc-avail__dayitem mh-hcc-avail__dayitem--link${
                          selectedSlotKey === key ? " is-active" : ""
                        }`}
                        onClick={() => {
                          setSelectedSlotKey(key);
                          setDetailSlotKey(key);
                        }}
                      >
                        <strong>{slot.title || slot.mode}</strong>
                        <span>
                          {formatClockLabel(slot.start)}–{formatClockLabel(slot.end)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <AvailabilityModal
        open={addOpen}
        defaultType={addType}
        defaultDate={selectedIso}
        onClose={() => setAddOpen(false)}
        onSaved={async () => {
          await live?.refresh();
          setSelectedSlotKey(null);
          if (selectedIso) {
            // keep day selected so the new window appears under the calendar
            setSelectedIso(selectedIso);
          }
        }}
      />

      {detailSlot ? (
        <AvailabilityDetailModal
          slot={detailSlot}
          onClose={() => setDetailSlotKey(null)}
          onFocusDay={(iso) => {
            const [y, m] = iso.split("-").map(Number);
            if (y && m) {
              setYear(y);
              setMonth(m - 1);
            }
            setSelectedIso(iso);
          }}
        />
      ) : null}

      {generalOpen ? (
        <ModalShell
          title="GENERAL INFORMATION"
          section="CONTENT"
          onClose={() => setGeneralOpen(false)}
          footer={
            <button type="submit" form="general-form" className="mh-hcc-modal__save">
              Save Content
            </button>
          }
        >
          <form id="general-form" onSubmit={saveGeneral}>
            <div className="mh-hcc-rte__toolbar" aria-hidden>
              <select defaultValue="sans-serif">
                <option>sans-serif</option>
                <option>serif</option>
              </select>
              <select defaultValue="10pt">
                <option>10pt</option>
                <option>12pt</option>
                <option>14pt</option>
              </select>
              <button type="button">B</button>
              <button type="button">I</button>
              <button type="button">U</button>
            </div>
            <textarea
              className="mh-hcc-rte__editor"
              rows={10}
              value={generalHtml}
              onChange={(e) => setGeneralHtml(e.target.value)}
              placeholder="Write general availability information…"
            />
            <p className="mh-hcc-rte__words">{words} WORDS</p>
          </form>
        </ModalShell>
      ) : null}
    </FacultyProfileLayout>
  );
}

export function CompensationView({ config }: { config: TeacherScreenConfig }) {
  const c = config.compensation;
  return (
    <FacultyProfileLayout config={config} tabs={c?.tabs}>
      <div className="mh-hcc-profile__split">
        <section>
          <h2>PREVIOUS CONTRACTS</h2>
          <p className="mh-teacher-muted">No contracts found.</p>
        </section>
        <section>
          <h2>CURRENT CONTRACT</h2>
          <table className="mh-hcc-profile__table">
            <thead>
              <tr>
                <th>CONTRACT</th>
                <th>COMPENSATION</th>
                <th>REQUIREMENTS</th>
                <th>EARNINGS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4}>No contracts found.</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </FacultyProfileLayout>
  );
}

export function ScheduleView({ config }: { config: TeacherScreenConfig }) {
  const live = useOptionalTeacherLive();
  const s = config.schedule;
  const [weekStart, setWeekStart] = useState(s?.weekStart || "2026-09-13");
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<{
    kind: string;
    title: string;
    time: string;
    dayLabel: string;
    dateLabel?: string;
    course?: string;
    section?: string;
    location?: string;
    mode?: string;
    note?: string;
    repeats?: string;
    joinUrl?: string;
    sessionTitle?: string;
  } | null>(null);

  useEffect(() => {
    if (s?.weekStart) setWeekStart(s.weekStart);
  }, [s?.weekStart]);

  const weekDays = useMemo(() => {
    if (s?.weekDays?.length) return s.weekDays;
    return [];
  }, [s?.weekDays]);

  function shiftWeek(delta: number) {
    const d = new Date(`${weekStart}T12:00:00`);
    d.setDate(d.getDate() + delta * 7);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setWeekStart(iso);
  }

  const weekLabel = useMemo(() => {
    const start = new Date(`${weekStart}T12:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })} - ${end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`.toUpperCase();
  }, [weekStart]);

  return (
    <FacultyProfileLayout config={config} tabs={s?.tabs} contentClassName="mh-ct-profile__card--schedule">
      <div className="mh-hcc-profile__split mh-hcc-profile__split--schedule mh-hcc-profile__split--schedule-only">
        <section className="mh-hcc-weekcal">
          <div className="mh-hcc-profile__card-head">
            <h2>SCHEDULE</h2>
            <button type="button" className="mh-hcc-profile__add" onClick={() => setAddOpen(true)}>
              + Add
            </button>
          </div>
          <div className="mh-hcc-weekcal__nav">
            <button type="button" onClick={() => shiftWeek(-1)}>
              &lt; PREVIOUS WEEK
            </button>
            <strong>{weekLabel}</strong>
            <button type="button" onClick={() => shiftWeek(1)}>
              NEXT WEEK &gt;
            </button>
          </div>
          <div className="mh-hcc-weekcal__grid">
            {(weekDays.length
              ? weekDays
              : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((label, i) => {
                  const d = new Date(`${weekStart}T12:00:00`);
                  d.setDate(d.getDate() + i);
                  return {
                    label,
                    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
                    dateLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                    entries: [] as NonNullable<NonNullable<TeacherScreenConfig["schedule"]>["weekDays"]>[number]["entries"],
                  };
                })
            ).map((day, i) => (
              <div key={day.label} className={`mh-hcc-weekcal__col mh-hcc-weekcal__col--${i}`}>
                <header>
                  <strong>{day.label}</strong>
                  <span>{day.dateLabel}</span>
                </header>
                <div className="mh-hcc-weekcal__body">
                  {(day.entries || []).length === 0 ? (
                    <p className="mh-teacher-muted mh-hcc-weekcal__empty">No sessions</p>
                  ) : (
                    (day.entries || []).map((entry, idx) => (
                      <button
                        key={`${day.date}-${entry.title}-${idx}`}
                        type="button"
                        className={`mh-hcc-weekcal__event is-${entry.kind || "class"}`}
                        onClick={() =>
                          setSelected({
                            ...entry,
                            kind: entry.kind || "class",
                            dayLabel: day.label,
                            dateLabel: day.dateLabel || day.date,
                          })
                        }
                      >
                        <strong>{entry.title}</strong>
                        <span>{entry.time}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <AvailabilityModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={async () => live?.refresh()} />
      {selected ? (
        <ModalShell
          title="SCHEDULE DETAILS"
          section={selected.kind === "availability" ? "AVAILABILITY" : "CLASS SESSION"}
          onClose={() => setSelected(null)}
          footer={
            <button type="button" className="mh-hcc-modal__save" onClick={() => setSelected(null)}>
              Close
            </button>
          }
        >
          <dl className="mh-hcc-slot-detail">
            <div>
              <dt>Title</dt>
              <dd>{selected.sessionTitle || selected.title}</dd>
            </div>
            {selected.course ? (
              <div>
                <dt>Course</dt>
                <dd>
                  {selected.course}
                  {selected.section ? ` · Section ${selected.section}` : ""}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>When</dt>
              <dd>
                {selected.dayLabel}
                {selected.dateLabel ? ` · ${selected.dateLabel}` : ""}
                <br />
                {selected.time}
              </dd>
            </div>
            {selected.mode ? (
              <div>
                <dt>Type</dt>
                <dd>{selected.mode}</dd>
              </div>
            ) : null}
            {selected.location ? (
              <div>
                <dt>Location</dt>
                <dd>{selected.location}</dd>
              </div>
            ) : null}
            {selected.repeats ? (
              <div>
                <dt>Repeats</dt>
                <dd>{selected.repeats}</dd>
              </div>
            ) : null}
            {selected.note ? (
              <div>
                <dt>Note</dt>
                <dd>{selected.note}</dd>
              </div>
            ) : null}
            {selected.joinUrl ? (
              <div>
                <dt>Join link</dt>
                <dd>
                  <a href={selected.joinUrl} target="_blank" rel="noreferrer">
                    Open session
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </ModalShell>
      ) : null}
    </FacultyProfileLayout>
  );
}

export function SettingsView({ config }: { config: TeacherScreenConfig }) {
  const live = useOptionalTeacherLive();
  const initial =
    config.settings?.groups?.[0]?.fields?.find((f) => f.label === "New Time Zone")?.value || DEFAULT_HCC_TIME_ZONE;
  const [zone, setZone] = useState(initial);
  const current =
    config.settings?.groups?.[0]?.fields?.find((f) => f.label === "Current Time")?.value ||
    new Date().toLocaleString();

  useEffect(() => setZone(initial), [initial]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    await live?.runAction("Save Time Zone", JSON.stringify({ "New Time Zone": zone }));
    await live?.refresh();
  }

  return (
    <div className="mh-hcc-timezone" data-figma-id={config.figmaId}>
      <h1>CHANGE YOUR TIME ZONE</h1>
      <form onSubmit={onSave}>
        <label>
          <span>Current Time</span>
          <input className="mh-teacher-field" value={current} readOnly />
        </label>
        <label>
          <span>New Time Zone</span>
          <select className="mh-teacher-field mh-hcc-timezone__select" value={zone} onChange={(e) => setZone(e.target.value)} size={12}>
            {HCC_TIME_ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="mh-hcc-modal__save">
          Save Time Zone
        </button>
      </form>
    </div>
  );
}

export function SecurityView({ config }: { config: TeacherScreenConfig }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!verified) {
    return (
      <div className="mh-hcc-verify" data-figma-id={config.figmaId}>
        <h1>ACCOUNT VERIFICATION REQUIRED</h1>
        <p>To continue, first verify that it&apos;s you by entering your current password.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!currentPassword.trim()) {
              setError("Enter your current password.");
              return;
            }
            setError(null);
            setVerified(true);
          }}
        >
          <label>
            <span>Current Password</span>
            <input
              type="password"
              className="mh-teacher-field"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          {error ? <p className="mh-teacher-error">{error}</p> : null}
          <button type="submit" className="mh-hcc-modal__save">
            Continue
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mh-hcc-verify" data-figma-id={config.figmaId}>
      <h1>Security Settings</h1>
      <p className="mh-teacher-muted">Account verified. Manage password and session security from here.</p>
      <p>
        MFA: <strong>{config.security?.mfaEnabled ? "Enabled" : "Not enabled"}</strong>
      </p>
    </div>
  );
}

export function AccomplishmentsView({ config }: { config: TeacherScreenConfig }) {
  const live = useOptionalTeacherLive();
  const router = useRouter();
  const a = config.accomplishments;
  const items = a?.items ?? [];
  const stats = a?.stats ?? [];
  const definitions = a?.definitions ?? [];
  const createBase = a?.createBase;
  const facultyItems = items.filter((i) => i.category !== "student");
  const studentItems = items.filter((i) => i.category === "student");
  const [open, setOpen] = useState(false);
  const [baseOpen, setBaseOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [baseValues, setBaseValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of createBase?.groups ?? []) {
      for (const f of g.fields) init[f.label] = f.value ?? "";
    }
    return init;
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Enter an accomplishment title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await live?.runAction(
        "Save Accomplishment",
        JSON.stringify({ Title: title.trim(), Detail: detail.trim(), Year: year.trim() }),
      );
      setOpen(false);
      setTitle("");
      setDetail("");
      await live?.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save accomplishment.");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveBase(e: FormEvent) {
    e.preventDefault();
    if (!(baseValues.Name || "").trim()) {
      setError("Enter a badge base name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await live?.runAction("Create Base", JSON.stringify(baseValues));
      setBaseOpen(false);
      await live?.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save badge base.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FacultyProfileLayout config={config} tabs={a?.tabs}>
      <div className="mh-hcc-accomplish" data-figma-id={config.figmaId}>
        <div className="mh-hcc-profile__card-head">
          <h2>MY ACCOMPLISHMENTS &amp; BADGES</h2>
          <div className="mh-hcc-accomplish__actions">
            <button type="button" className="mh-hcc-profile__add" onClick={() => setBaseOpen(true)}>
              + Create Base
            </button>
            <button type="button" className="mh-hcc-profile__add" onClick={() => setOpen(true)}>
              + Add
            </button>
          </div>
        </div>

        {stats.length ? (
          <div className="mh-hcc-accomplish__stats">
            {stats.map((s) => (
              <div key={s.label} className="mh-hcc-accomplish__stat">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        <section className="mh-hcc-profile__card mh-hcc-accomplish__base">
          <div className="mh-hcc-profile__card-head">
            <h2>CREATE BASE</h2>
            <button
              type="button"
              className="mh-teacher-link"
              onClick={() => router.push(createBase?.href || "/instructor/f/t70-add-badge")}
            >
              Full badge form
            </button>
          </div>
          {definitions.length === 0 ? (
            <p className="mh-teacher-muted">
              No badge bases yet. Create a base definition students can earn, then issue awards from Badges /
              Accomplishments.
            </p>
          ) : (
            <ul className="mh-hcc-accomplish__list">
              {definitions.map((d) => (
                <li key={d.id}>
                  <div>
                    <strong>{d.name}</strong>
                    {d.description ? <p>{d.description}</p> : null}
                    <p className="mh-teacher-muted">
                      {d.badgeType} · {d.approvalMode}
                    </p>
                  </div>
                  <span className="mh-teacher-badge mh-teacher-badge--info">{d.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mh-hcc-accomplish__grid">
          <section className="mh-hcc-profile__card">
            <div className="mh-hcc-profile__card-head">
              <h2>FACULTY RECORD</h2>
            </div>
            {facultyItems.length === 0 ? (
              <p className="mh-teacher-muted">No faculty accomplishments yet. Add awards, certifications, or recognitions.</p>
            ) : (
              <ul className="mh-hcc-accomplish__list">
                {facultyItems.map((item) => (
                  <li key={`${item.title}-${item.year}-${item.detail}`}>
                    <div>
                      <strong>{item.title}</strong>
                      {item.detail ? <p>{item.detail}</p> : null}
                    </div>
                    <span className={`mh-teacher-badge mh-teacher-badge--${item.tone || "success"}`}>
                      {item.year}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mh-hcc-profile__card">
            <div className="mh-hcc-profile__card-head">
              <h2>STUDENT BADGES ISSUED</h2>
            </div>
            {studentItems.length === 0 ? (
              <p className="mh-teacher-muted">No student badges issued from your sections yet.</p>
            ) : (
              <ul className="mh-hcc-accomplish__list">
                {studentItems.map((item) => (
                  <li key={`${item.title}-${item.year}-${item.detail}`}>
                    <div>
                      <strong>{item.title}</strong>
                      {item.detail ? <p>{item.detail}</p> : null}
                    </div>
                    <span className={`mh-teacher-badge mh-teacher-badge--${item.tone || "info"}`}>
                      {item.year}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {open ? (
        <ModalShell
          title="Add accomplishment"
          section="Faculty record"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="mh-hcc-modal__cancel" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" form="mh-accomplish-form" className="mh-hcc-modal__save" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          <form id="mh-accomplish-form" className="mh-hcc-modal__form" onSubmit={onSave}>
            <label>
              <span>Title</span>
              <input className="mh-teacher-field" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              <span>Detail</span>
              <textarea className="mh-teacher-field" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
            </label>
            <label>
              <span>Year</span>
              <input className="mh-teacher-field" value={year} onChange={(e) => setYear(e.target.value)} />
            </label>
            {error ? <p className="mh-teacher-error">{error}</p> : null}
          </form>
        </ModalShell>
      ) : null}

      {baseOpen ? (
        <ModalShell
          title={createBase?.title || "Create Base"}
          section="Badge definition"
          onClose={() => setBaseOpen(false)}
          footer={
            <>
              <button type="button" className="mh-hcc-modal__cancel" onClick={() => setBaseOpen(false)}>
                Cancel
              </button>
              <button type="submit" form="mh-create-base-form" className="mh-hcc-modal__save" disabled={saving}>
                {saving ? "Saving…" : createBase?.submitLabel || "Save Badge / Accomplishment"}
              </button>
            </>
          }
        >
          <form id="mh-create-base-form" className="mh-hcc-modal__form" onSubmit={onSaveBase}>
            {(createBase?.groups ?? []).map((group) => (
              <fieldset key={group.title} className="mh-hcc-modal__fieldset">
                <legend>{group.title}</legend>
                {group.fields.map((field) => (
                  <label key={field.label}>
                    <span>{field.label}</span>
                    {field.type === "textarea" ? (
                      <textarea
                        className="mh-teacher-field"
                        rows={3}
                        value={baseValues[field.label] ?? ""}
                        onChange={(e) => setBaseValues((prev) => ({ ...prev, [field.label]: e.target.value }))}
                      />
                    ) : field.type === "select" ? (
                      <select
                        className="mh-teacher-field"
                        value={baseValues[field.label] ?? field.value}
                        onChange={(e) => setBaseValues((prev) => ({ ...prev, [field.label]: e.target.value }))}
                      >
                        {(field.options ?? []).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="mh-teacher-field"
                        type={field.type === "file" ? "text" : "text"}
                        placeholder={field.type === "file" ? "Image URL or file name" : undefined}
                        value={baseValues[field.label] ?? ""}
                        onChange={(e) => setBaseValues((prev) => ({ ...prev, [field.label]: e.target.value }))}
                      />
                    )}
                  </label>
                ))}
              </fieldset>
            ))}
            {error ? <p className="mh-teacher-error">{error}</p> : null}
          </form>
        </ModalShell>
      ) : null}
    </FacultyProfileLayout>
  );
}
