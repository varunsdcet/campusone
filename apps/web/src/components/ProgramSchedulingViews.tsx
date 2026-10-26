"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TeacherScreenConfig } from "@/lib/teacherCatalog";
import { useOptionalTeacherLive } from "@/lib/useTeacherSisLive";

function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mh-teacher-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="mh-teacher-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="mh-teacher-modal__panel">
        <div className="mh-teacher-modal__head">
          <h2>{title}</h2>
          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mh-teacher-modal__body">{children}</div>
        {footer ? <div className="mh-teacher-modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export const COURSE_BULK_ACTIONS = [
  { label: "-- Select Bulk Action --", value: "" },
  { label: "Course Category", value: "Course Category" },
  { label: "Credit Value", value: "Credit Value" },
  { label: "Grading Scheme", value: "Grading Scheme" },
  { label: "Repository Settings", value: "Repository Settings" },
  { label: "Chair / Lead Settings", value: "Chair / Lead Settings" },
];

export const SCHEDULE_BULK_ACTIONS = [
  { label: "-- Select Bulk Action --", value: "" },
  { label: "Change Dates", value: "Change Dates" },
  { label: "Course Size / Limit", value: "Course Size / Limit" },
  { label: "Delivery Method", value: "Delivery Method" },
  { label: "LMS / Import Options", value: "LMS / Import Options" },
  { label: "Grading Scheme", value: "Grading Scheme" },
  { label: "Instructor(s)", value: "Instructor(s)" },
  { label: "Location / Room", value: "Location / Room" },
  { label: "Wait List Settings", value: "Wait List Settings" },
];

export function BulkActionsModal({
  title = "Bulk Actions",
  options,
  onClose,
  onApply,
}: {
  title?: string;
  options: Array<{ label: string; value: string }>;
  onClose: () => void;
  onApply: (action: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="mh-teacher-btn"
            disabled={!value}
            onClick={() => {
              onApply(value);
              onClose();
            }}
          >
            Apply
          </button>
        </>
      }
    >
      <label className="mh-teacher-field--block">
        <span>Bulk Updates</span>
        <select className="mh-teacher-field" value={value} onChange={(e) => setValue(e.target.value)}>
          {options.map((o) => (
            <option key={`${o.value}-${o.label}`} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </Modal>
  );
}

function formatLongDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function ReviewTermView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const data = config.reviewTerm;
  if (!data) return null;

  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <section className="mh-teacher-card">
        <div className="mh-teacher-page-head" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Term Details</h2>
            <p className="mh-teacher-muted" style={{ margin: "4px 0 0" }}>
              {data.name}
              {data.code ? ` (${data.code})` : ""}
            </p>
          </div>
          <div className="mh-teacher-schemes-list__actions">
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--secondary"
              onClick={() => router.push("/instructor/f/t51-manage-terms")}
            >
              Back
            </button>
            <button
              type="button"
              className="mh-teacher-btn"
              onClick={() =>
                router.push(`/instructor/f/t76-add-term?termId=${encodeURIComponent(data.id)}`)
              }
            >
              Edit Term
            </button>
          </div>
        </div>
        <div className="mh-teacher-fields mh-teacher-review-term__fields">
          <div>
            <span className="mh-teacher-muted">Start Date</span>
            <strong>{formatLongDate(data.startsOn)}</strong>
          </div>
          <div>
            <span className="mh-teacher-muted">End Date</span>
            <strong>{formatLongDate(data.endsOn)}</strong>
          </div>
          <div className="mh-teacher-field--block">
            <span className="mh-teacher-muted">Campuses</span>
            <ul className="mh-teacher-review-term__campuses">
              {(data.campuses || []).map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

type ScheduleTab = "Schedule Outline" | "Fees & Tuition Price List" | "Settings & Conditions";

export function ScheduleManageView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const searchParams = useSearchParams();
  const data = config.scheduleManage;
  const [tab, setTab] = useState<ScheduleTab>(
    (data?.activeTab as ScheduleTab) || "Schedule Outline",
  );
  const [viewMode, setViewMode] = useState<"standard" | "calendar">(
    data?.viewMode === "calendar" ? "calendar" : "standard",
  );
  const [bulkOpen, setBulkOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState<"add" | "edit" | null>(null);
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [editingLedger, setEditingLedger] = useState<{
    id: string;
    type: string;
    domestic: string;
    international: string;
  } | null>(null);
  const [ledgerForm, setLedgerForm] = useState({ type: "", domestic: "0.00", international: "0.00" });
  const [termForm, setTermForm] = useState({
    name: "",
    condition: "Days Completed",
    requiredDays: "0",
    order: "Top",
  });
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [monthLabel, setMonthLabel] = useState(data?.calendar?.monthLabel || "November, 2026");

  useEffect(() => {
    if (!data?.settings) return;
    const next: Record<string, string> = {};
    for (const g of data.settings.groups) {
      for (const f of g.fields) next[f.label] = f.value;
    }
    setSettings(next);
  }, [data?.settings]);

  useEffect(() => {
    if (data?.calendar?.monthLabel) setMonthLabel(data.calendar.monthLabel);
  }, [data?.calendar?.monthLabel]);

  const calendarEvents = data?.calendar?.events;
  const calendarDays = useMemo(() => {
    const events = calendarEvents || [];
    const byDay: Record<number, typeof events> = {};
    for (const ev of events) {
      const day = ev.day || 0;
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(ev);
    }
    return byDay;
  }, [calendarEvents]);

  if (!data) return null;

  const scheduleId = searchParams.get("scheduleId") || data.scheduleId;
  const sessions = data.sessions || [];
  const ledgers = data.fees?.ledgers || [];
  const addSessionHref = `${data.addSessionHref || "/instructor/f/t78-add-session-offering"}?scheduleId=${encodeURIComponent(scheduleId)}`;

  async function saveLedger() {
    const payload = JSON.stringify({
      __scheduleId: scheduleId,
      __ledgerId: editingLedger?.id || "",
      "Tuition / Ledger Type": ledgerForm.type || editingLedger?.type || "",
      Domestic: ledgerForm.domestic,
      International: ledgerForm.international,
    });
    await live?.runAction?.(editingLedger ? "Save Ledger / Tuition Type" : "Add Ledger / Tuition Type", payload);
    setLedgerOpen(null);
    setEditingLedger(null);
    await live?.refresh?.();
  }

  async function saveScheduleTerm() {
    const payload = JSON.stringify({
      __scheduleId: scheduleId,
      "Term Name": termForm.name,
      "Term Condition": termForm.condition,
      "Required Days": termForm.requiredDays,
      "Term Order": termForm.order,
    });
    await live?.runAction?.("Save Schedule Term", payload);
    setTermModalOpen(false);
    await live?.refresh?.();
  }

  async function updateSettings() {
    const payload = JSON.stringify({ __scheduleId: scheduleId, ...settings });
    await live?.runAction?.("Update Schedule", payload);
    await live?.refresh?.();
  }

  return (
    <div className="mh-teacher-stack mh-teacher-schedule-manage" data-figma-id={config.figmaId}>
      <div className="mh-teacher-page-head">
        <div>
          <h2>{data.programTitle}</h2>
          <p className="mh-teacher-schedule-manage__range">{data.dateRange}</p>
          <div className="mh-teacher-schedule-manage__counters">
            <span>
              Total Courses: <strong>{data.totals.courses}</strong>
            </span>
            <span>
              Total Sessions: <strong>{data.totals.sessions}</strong>
            </span>
            <span>
              Conflicts: <strong>{data.totals.conflicts}</strong>
            </span>
            <span>
              Enrolled Students: <strong>{data.totals.enrolled}</strong>
            </span>
          </div>
        </div>
        <div className="mh-teacher-schemes-list__actions">
          {tab === "Schedule Outline" ? (
            <>
              <button type="button" className="mh-teacher-btn" onClick={() => router.push(addSessionHref)}>
                Add Session
              </button>
              <button
                type="button"
                className="mh-teacher-btn mh-teacher-btn--secondary"
                onClick={() => setBulkOpen(true)}
              >
                Bulk Actions
              </button>
              <button
                type="button"
                className="mh-teacher-btn mh-teacher-btn--secondary"
                onClick={() => setViewMode((v) => (v === "standard" ? "calendar" : "standard"))}
              >
                {viewMode === "standard" ? "Calendar View" : "Standard View"}
              </button>
            </>
          ) : null}
          {tab === "Fees & Tuition Price List" ? (
            <>
              <button
                type="button"
                className="mh-teacher-btn mh-teacher-btn--secondary"
                onClick={() => {
                  setTermForm({ name: "", condition: "Days Completed", requiredDays: "0", order: "Top" });
                  setTermModalOpen(true);
                }}
              >
                Add Term
              </button>
              <button
                type="button"
                className="mh-teacher-btn"
                onClick={() => {
                  setEditingLedger(null);
                  setLedgerForm({ type: "", domestic: "0.00", international: "0.00" });
                  setLedgerOpen("add");
                }}
              >
                Add Ledger / Tuition Type
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mh-teacher-course-admin__tabs" role="tablist">
        {(["Schedule Outline", "Fees & Tuition Price List", "Settings & Conditions"] as ScheduleTab[]).map(
          (t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`mh-teacher-course-admin__tab${tab === t ? " is-active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ),
        )}
      </div>

      {tab === "Schedule Outline" && viewMode === "standard" ? (
        <section className="mh-teacher-card">
          <div
            className="mh-teacher-table"
            style={{
              gridTemplateColumns:
                "minmax(180px,1.4fr) minmax(120px,1fr) minmax(100px,0.8fr) minmax(140px,1fr) minmax(120px,0.9fr) minmax(150px,0.9fr)",
            }}
          >
            <div className="mh-teacher-table__head">
              <span>Course</span>
              <span>Instructors</span>
              <span>Room</span>
              <span>Dates</span>
              <span>Schedule</span>
              <span aria-hidden="true" />
            </div>
            {sessions.length === 0 ? (
              <div className="mh-teacher-table__row">
                <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 6" }}>
                  {live?.loading ? "Loading sessions…" : "No sessions on this schedule yet."}
                </span>
              </div>
            ) : (
              sessions.map((row) => (
                <div key={row.id} className="mh-teacher-table__row">
                  <span>
                    <strong>{row.course}</strong>
                    {row.title ? <em className="mh-teacher-manage-terms__code">{row.title}</em> : null}
                  </span>
                  <span>{row.instructors || "Not Set"}</span>
                  <span>{row.room || "Not Set"}</span>
                  <span>{row.dates}</span>
                  <span>{row.schedule}</span>
                  <span className="mh-teacher-schemes-list__actions">
                    <button
                      type="button"
                      className="mh-teacher-link"
                      onClick={() =>
                        router.push(`${addSessionHref}&sessionId=${encodeURIComponent(row.id)}`)
                      }
                    >
                      VIEW
                    </button>
                    <button
                      type="button"
                      className="mh-teacher-link"
                      onClick={() =>
                        router.push(`${addSessionHref}&sessionId=${encodeURIComponent(row.id)}`)
                      }
                    >
                      EDIT
                    </button>
                    <button
                      type="button"
                      className="mh-teacher-link mh-teacher-link--danger"
                      disabled={live?.busy}
                      onClick={() => void live?.runAction?.("Delete Schedule Session", row.id)}
                    >
                      DELETE
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {tab === "Schedule Outline" && viewMode === "calendar" ? (
        <section className="mh-teacher-card mh-teacher-schedule-cal">
          <div className="mh-teacher-toolbar">
            <label className="mh-teacher-schemes-list__filter">
              <span className="mh-teacher-sr-only">Month</span>
              <select
                className="mh-teacher-field"
                value={monthLabel}
                onChange={(e) => setMonthLabel(e.target.value)}
              >
                {(data.calendar?.monthOptions || [monthLabel]).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            {data.calendar?.nextMonthHint ? (
              <span className="mh-teacher-muted">{data.calendar.nextMonthHint}</span>
            ) : null}
          </div>
          <div className="mh-teacher-schedule-cal__grid">
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
              (day) => (
                <div key={day} className="mh-teacher-schedule-cal__head">
                  {day}
                </div>
              ),
            )}
            {Array.from({ length: 35 }, (_, i) => {
              const dayNum = i - (data.calendar?.startOffset ?? 0) + 1;
              const inMonth = dayNum >= 1 && dayNum <= (data.calendar?.daysInMonth ?? 30);
              const dayEvents = inMonth ? calendarDays[dayNum] || [] : [];
              return (
                <div
                  key={i}
                  className={`mh-teacher-schedule-cal__cell${inMonth ? "" : " is-outside"}`}
                >
                  {inMonth ? <span className="mh-teacher-schedule-cal__day">{dayNum}</span> : null}
                  {dayEvents.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      className={`mh-teacher-schedule-cal__event is-${ev.tone || "primary"}`}
                      onClick={() =>
                        router.push(`${addSessionHref}&sessionId=${encodeURIComponent(ev.sessionId || ev.id)}`)
                      }
                    >
                      <strong>{ev.code}</strong>
                      <span>{ev.title}</span>
                      <em>{ev.time}</em>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "Fees & Tuition Price List" ? (
        <section className="mh-teacher-card">
          <div
            className="mh-teacher-table"
            style={{ gridTemplateColumns: "40px minmax(180px,1.2fr) minmax(220px,1.4fr) minmax(140px,0.8fr)" }}
          >
            <div className="mh-teacher-table__head">
              <span aria-hidden="true" />
              <span>Ledger / Tuition Type</span>
              <span>Fees</span>
              <span aria-hidden="true" />
            </div>
            {ledgers.length === 0 ? (
              <div className="mh-teacher-table__row">
                <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 4" }}>
                  No ledger / tuition types yet.
                </span>
              </div>
            ) : (
              ledgers.map((row) => (
                <div key={row.id} className="mh-teacher-table__row">
                  <span className="mh-teacher-drag-handle" aria-hidden="true">
                    ⋮⋮
                  </span>
                  <span>
                    <strong>{row.type}</strong>
                  </span>
                  <span>
                    Domestic: ${row.domestic}
                    <br />
                    International: ${row.international}
                  </span>
                  <span className="mh-teacher-schemes-list__actions">
                    <button
                      type="button"
                      className="mh-teacher-link"
                      onClick={() => {
                        setEditingLedger(row);
                        setLedgerForm({
                          type: row.type,
                          domestic: row.domestic,
                          international: row.international,
                        });
                        setLedgerOpen("edit");
                      }}
                    >
                      EDIT
                    </button>
                    <button
                      type="button"
                      className="mh-teacher-link mh-teacher-link--danger"
                      disabled={live?.busy}
                      onClick={() => void live?.runAction?.("Delete Ledger / Tuition Type", row.id)}
                    >
                      DELETE
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {tab === "Settings & Conditions" && data.settings ? (
        <section className="mh-teacher-card">
          {data.settings.groups.map((g) => (
            <div key={g.title} className="mh-teacher-schedule-settings__group">
              <h3>{g.title}</h3>
              <div className="mh-teacher-fields">
                {g.fields.map((field) => {
                  const isCheck = field.type === "checkbox";
                  const isPair = field.type === "pair";
                  return (
                    <label key={field.label} className={isCheck || isPair ? "mh-teacher-field--block" : undefined}>
                      {isCheck ? null : (
                        <span>
                          {field.label}
                          {field.hint ? <em className="mh-teacher-sublabel"> · {field.hint}</em> : null}
                          {field.optional ? <em className="mh-teacher-sublabel"> · Optional</em> : null}
                        </span>
                      )}
                      {isCheck ? (
                        <span className="mh-teacher-check">
                          <input
                            type="checkbox"
                            checked={(settings[field.label] || "") === "true"}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                [field.label]: e.target.checked ? "true" : "false",
                              }))
                            }
                          />
                          <em>{field.label}</em>
                        </span>
                      ) : isPair ? (
                        <div className="mh-teacher-pair">
                          <input
                            className="mh-teacher-field"
                            value={settings[field.label] ?? ""}
                            onChange={(e) =>
                              setSettings((prev) => ({ ...prev, [field.label]: e.target.value }))
                            }
                          />
                          <select
                            className="mh-teacher-field"
                            value={settings[`${field.label} Unit`] ?? field.unitValue ?? ""}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                [`${field.label} Unit`]: e.target.value,
                              }))
                            }
                          >
                            {(field.unitOptions || []).map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : field.type === "select" || (field.options && field.options.length > 0) ? (
                        <select
                          className="mh-teacher-field"
                          value={settings[field.label] ?? ""}
                          onChange={(e) =>
                            setSettings((prev) => ({ ...prev, [field.label]: e.target.value }))
                          }
                        >
                          {(field.options || []).map((o) => (
                            <option key={`${o.value}-${o.label}`} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="mh-teacher-field"
                          value={settings[field.label] ?? ""}
                          onChange={(e) =>
                            setSettings((prev) => ({ ...prev, [field.label]: e.target.value }))
                          }
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mh-teacher-form-actions">
            <button type="button" className="mh-teacher-btn" disabled={live?.busy} onClick={() => void updateSettings()}>
              Update Schedule
            </button>
          </div>
        </section>
      ) : null}

      {bulkOpen ? (
        <BulkActionsModal
          options={SCHEDULE_BULK_ACTIONS}
          onClose={() => setBulkOpen(false)}
          onApply={(action) => void live?.runAction?.("Bulk Schedule Action", action)}
        />
      ) : null}

      {ledgerOpen ? (
        <Modal
          title={ledgerOpen === "edit" ? "Edit Ledger / Tuition Type" : "Add Ledger / Tuition Type"}
          onClose={() => {
            setLedgerOpen(null);
            setEditingLedger(null);
          }}
          footer={
            <button type="button" className="mh-teacher-btn" disabled={live?.busy} onClick={() => void saveLedger()}>
              Save Ledger / Tuition Type
            </button>
          }
        >
          <h3>Ledger / Tuition Type Settings</h3>
          <div className="mh-teacher-fields">
            <label>
              <span>Tuition / Ledger Type</span>
              <select
                className="mh-teacher-field"
                value={ledgerForm.type}
                onChange={(e) => setLedgerForm((p) => ({ ...p, type: e.target.value }))}
              >
                <option value="">-- Select Tuition / Ledger Type --</option>
                {(data.fees?.ledgerTypeOptions || [
                  "Assessment Fee",
                  "Application Fee",
                  "Textbooks",
                  "Tuition Fee",
                ]).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Domestic</span>
              <span className="mh-hcc-money">
                <em>$</em>
                <input
                  className="mh-teacher-field"
                  value={ledgerForm.domestic}
                  onChange={(e) => setLedgerForm((p) => ({ ...p, domestic: e.target.value }))}
                />
              </span>
            </label>
            <label>
              <span>International</span>
              <span className="mh-hcc-money">
                <em>$</em>
                <input
                  className="mh-teacher-field"
                  value={ledgerForm.international}
                  onChange={(e) => setLedgerForm((p) => ({ ...p, international: e.target.value }))}
                />
              </span>
            </label>
          </div>
        </Modal>
      ) : null}

      {termModalOpen ? (
        <Modal
          title="Add Term"
          onClose={() => setTermModalOpen(false)}
          footer={
            <button
              type="button"
              className="mh-teacher-btn"
              disabled={live?.busy || !termForm.name.trim()}
              onClick={() => void saveScheduleTerm()}
            >
              Save Term
            </button>
          }
        >
          <h3>Term Settings</h3>
          <div className="mh-teacher-fields">
            <label>
              <span>
                Term Name <em className="mh-teacher-field-lang">English</em>
              </span>
              <input
                className="mh-teacher-field"
                value={termForm.name}
                onChange={(e) => setTermForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label>
              <span>Term Condition</span>
              <select
                className="mh-teacher-field"
                value={termForm.condition}
                onChange={(e) => setTermForm((p) => ({ ...p, condition: e.target.value }))}
              >
                <option value="Days Completed">Days Completed</option>
                <option value="Percentage Completed">Percentage Completed</option>
                <option value="Courses Completed">Courses Completed</option>
              </select>
            </label>
            <label>
              <span>Required Days</span>
              <input
                className="mh-teacher-field"
                type="number"
                value={termForm.requiredDays}
                onChange={(e) => setTermForm((p) => ({ ...p, requiredDays: e.target.value }))}
              />
            </label>
            <label>
              <span>Term Order</span>
              <select
                className="mh-teacher-field"
                value={termForm.order}
                onChange={(e) => setTermForm((p) => ({ ...p, order: e.target.value }))}
              >
                <option value="Top">Top</option>
                <option value="Bottom">Bottom</option>
              </select>
            </label>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
