"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import { WEEKDAYS, isoDate, type AvailabilityRecord, type TeachingSession } from "@/lib/superAdmin";

export type SlotPick = { date: string; startTime?: string; endTime?: string };

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "Available to Teach": { bg: "#dbeafe", border: "#2563eb", text: "#1e3a8a" },
  "Office Hours": { bg: "#fef3c7", border: "#d97706", text: "#78350f" },
};
const OTHER_COLOR = { bg: "#ede9fe", border: "#7c3aed", text: "#4c1d95" };
const CLASS_COLOR = { bg: "#dcfce7", border: "#16a34a", text: "#14532d" };

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function availabilityEvents(records: AvailabilityRecord[]): EventInput[] {
  return records.map((r) => {
    const c = TYPE_COLORS[r.type] ?? OTHER_COLOR;
    const base: EventInput = {
      id: r.id,
      title: r.title ? `${r.title} · ${r.type}` : r.type,
      backgroundColor: c.bg,
      borderColor: c.border,
      textColor: c.text,
      classNames: ["mh-fc__event"],
      extendedProps: { kind: "availability", note: r.note },
    };
    if (r.recurring) {
      return {
        ...base,
        groupId: r.id,
        daysOfWeek: r.days.map((d) => WEEKDAYS.indexOf(d as (typeof WEEKDAYS)[number])),
        startTime: r.startTime,
        endTime: r.endTime,
        startRecur: r.startDate,
        endRecur: addDays(r.endDate || r.startDate, 1),
      };
    }
    return { ...base, start: `${r.startDate}T${r.startTime}`, end: `${r.startDate}T${r.endTime}` };
  });
}

function sessionEvents(sessions: TeachingSession[]): EventInput[] {
  return sessions.map((s) => ({
    id: `class-${s.id}`,
    title: `${s.title} (${s.section})`,
    start: s.start,
    end: s.end ?? undefined,
    backgroundColor: CLASS_COLOR.bg,
    borderColor: CLASS_COLOR.border,
    textColor: CLASS_COLOR.text,
    classNames: ["mh-fc__event", "mh-fc__event--class"],
    extendedProps: { kind: "class", location: s.location, deliveryMethod: s.deliveryMethod },
  }));
}

const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export function ProfileCalendar({
  mode,
  records,
  sessions = [],
  onPick,
  onOpen,
  heading,
  actions,
}: {
  mode: "month" | "week";
  records: AvailabilityRecord[];
  sessions?: TeachingSession[];
  onPick: (slot: SlotPick) => void;
  onOpen: (record: AvailabilityRecord) => void;
  heading?: ReactNode;
  actions?: ReactNode;
}) {
  const ref = useRef<FullCalendar>(null);
  const [title, setTitle] = useState("");
  const [view, setView] = useState(mode === "month" ? "dayGridMonth" : "timeGridWeek");
  const events = useMemo(() => [...availabilityEvents(records), ...sessionEvents(sessions)], [records, sessions]);
  const api = () => ref.current?.getApi();

  function onDates(arg: DatesSetArg) {
    setView(arg.view.type);
    if (arg.view.type === "dayGridMonth") {
      setTitle(arg.view.currentStart.toLocaleDateString("en-US", { month: "long", year: "numeric" }));
    } else {
      const last = new Date(arg.view.currentEnd);
      last.setDate(last.getDate() - 1);
      setTitle(`${longDate(arg.view.currentStart)} – ${longDate(last)}`);
    }
  }

  function onEventClick(arg: EventClickArg) {
    if (arg.event.extendedProps.kind !== "availability") return;
    const rec = records.find((r) => r.id === arg.event.id || r.id === arg.event.groupId);
    if (rec) onOpen(rec);
  }

  const weekly = view !== "dayGridMonth";

  return (
    <div className="mh-fc">
      {mode === "week" ? (
        <div className="mh-fc__toolbar">
          <div className="mh-fc__heading">{heading}</div>
          <div className="mh-fc__nav">
            <button type="button" className="mh-sa__btn" onClick={() => api()?.prev()}>
              ‹ Previous Week
            </button>
            <strong className="mh-fc__title">{title}</strong>
            <button type="button" className="mh-sa__btn" onClick={() => api()?.next()}>
              Next Week ›
            </button>
            <button type="button" className="mh-sa__btn" onClick={() => api()?.today()}>
              Current Week
            </button>
            {actions}
          </div>
        </div>
      ) : (
        <div className="mh-fc__toolbar">
          <div className="mh-fc__nav">
            <button type="button" className="mh-sa__btn" onClick={() => api()?.prev()}>
              {weekly ? "‹ Previous Week" : "‹ Previous"}
            </button>
            <button type="button" className="mh-sa__btn" onClick={() => api()?.today()}>
              {weekly ? "Current Week" : "Today"}
            </button>
          </div>
          <strong className="mh-fc__title">{title}</strong>
          <div className="mh-fc__nav">
            <button type="button" className="mh-sa__btn" onClick={() => api()?.next()}>
              {weekly ? "Next Week ›" : "Next ›"}
            </button>
            <div className="mh-fc__views" role="group" aria-label="Calendar view">
              <button type="button" className={view === "dayGridMonth" ? "is-on" : ""} onClick={() => api()?.changeView("dayGridMonth")}>
                Month
              </button>
              <button type="button" className={view === "timeGridWeek" ? "is-on" : ""} onClick={() => api()?.changeView("timeGridWeek")}>
                Week
              </button>
            </div>
          </div>
        </div>
      )}

      <FullCalendar
        ref={ref}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={mode === "month" ? "dayGridMonth" : "timeGridWeek"}
        headerToolbar={false}
        firstDay={0}
        height={mode === "month" ? "auto" : 680}
        events={events}
        eventDisplay="block"
        dayMaxEvents={3}
        allDaySlot={false}
        nowIndicator
        scrollTime="08:00:00"
        slotDuration="00:30:00"
        slotLabelFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", meridiem: "short" }}
        views={{ dayGridMonth: { eventTimeFormat: { hour: "numeric", minute: "2-digit", meridiem: "narrow" } } }}
        dayHeaderContent={(arg) =>
          arg.view.type === "dayGridMonth" ? (
            arg.date.toLocaleDateString("en-US", { weekday: "short" })
          ) : (
            <span className="mh-fc__dayhead">
              <b>{arg.date.toLocaleDateString("en-US", { weekday: "long" })}</b>
              <small>{arg.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small>
            </span>
          )
        }
        selectable
        selectMirror
        unselectAuto
        select={(arg) => {
          api()?.unselect();
          if (arg.view.type === "dayGridMonth") {
            onPick({ date: isoDate(arg.start) });
          } else {
            onPick({ date: isoDate(arg.start), startTime: hhmm(arg.start), endTime: hhmm(arg.end) });
          }
        }}
        eventClick={onEventClick}
        eventDidMount={(arg) => {
          const p = arg.event.extendedProps;
          const extra = p.kind === "class" ? [p.deliveryMethod, p.location].filter(Boolean).join(" · ") : p.note;
          arg.el.title = extra ? `${arg.event.title}\n${extra}` : arg.event.title;
        }}
        datesSet={onDates}
      />

      <ul className="mh-fc__legend">
        <li>
          <i style={{ background: TYPE_COLORS["Available to Teach"].border }} /> Available to Teach
        </li>
        <li>
          <i style={{ background: TYPE_COLORS["Office Hours"].border }} /> Office Hours
        </li>
        {sessions.length ? (
          <li>
            <i style={{ background: CLASS_COLOR.border }} /> Scheduled class
          </li>
        ) : null}
        <li className="mh-fc__hint">{weekly ? "Drag across time slots to add availability." : "Click a day to add availability."}</li>
      </ul>
    </div>
  );
}
