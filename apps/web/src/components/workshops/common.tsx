"use client";

import "../superadmin/superadmin.css";
import "../requests/requests.css";
import "./workshops.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, api, loadSession } from "@/lib/api";
import { heritageHref } from "@/lib/heritageNav";

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */

export const ws = <T,>(path: string, init?: RequestInit) => api<T>(`/admin/heritage/workshops${path}`, init ?? {}, loadSession()?.accessToken);
export const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback);
export const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export type Option = { value: string; label: string };
export type Meta = {
  categories: Array<{ id: string; name: string; abbreviation: string }>;
  roles: Array<{ id: string; name: string; status: string }>;
  instructors: Array<{ id: string; name: string }>;
  campuses: Option[];
  classrooms: Array<Option & { campus: string; size: number }>;
  workshops: Array<{ id: string; label: string }>;
  gradingSchemes: string[];
  accessLevels: string[];
  studentStatuses: string[];
  programs: string[];
  campusAccess: string[];
  competencies: string[];
  options: {
    statuses: string[];
    roleModes: string[];
    privacy: string[];
    approval: string[];
    scheduleTypes: string[];
    feeCollection: string[];
    lms: string[];
    visibility: string[];
    weekdays: string[];
    enrolmentStatuses: string[];
    myFilters: string[];
    completion: string[];
  };
};

let metaCache: Promise<Meta> | null = null;
export function invalidateMeta() {
  metaCache = null;
}
export function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    metaCache ??= ws<Meta>("/meta");
    metaCache.then(setMeta).catch(() => {
      metaCache = null;
    });
  }, []);
  return meta;
}

export type WorkshopSummary = {
  id: string;
  code: string;
  title: string;
  category: string;
  categoryAbbreviation: string;
  instructors: string[];
  status: string;
  phase: "upcoming" | "active" | "completed" | "inactive";
  adminStatus: string;
  length: string;
  startDate: string;
  endDate: string;
  continuous: boolean;
  schedule: string;
  campus: string;
  classroom: string;
  capacity: number;
  seatsLeft: number;
  counts: { pending: number; approved: number; declined: number; dropped: number };
  privacy: string;
  approval: string;
  fee: number;
  enrolmentCutoff: string;
  cutoffPassed: boolean;
  hasImage: boolean;
};

export type StudentRef = { id: string; name: string; preferredName: string; familyName: string; studentNumber: string; login: string; programCode: string };

/* ------------------------------------------------------------------ */
/* Formatting                                                           */
/* ------------------------------------------------------------------ */

const MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
const DAYS = ["Sun.", "Mon.", "Tue.", "Wed.", "Thu.", "Fri.", "Sat."];

export function fmtDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function fmtWeekday(iso: string) {
  return DAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
}

export const stamp = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export function dateRange(w: Pick<WorkshopSummary, "startDate" | "endDate" | "continuous">) {
  if (w.continuous) return `${fmtDate(w.startDate)} – ongoing`;
  if (!w.endDate || w.endDate === w.startDate) return fmtDate(w.startDate);
  return `${fmtDate(w.startDate)} – ${fmtDate(w.endDate)}`;
}

export const money = (n: number) => `$${n.toFixed(2)}`;

export const studentHref = (id: string) => heritageHref("S03", { ctx: `student:${id}` });

/* ------------------------------------------------------------------ */
/* Shared cells                                                         */
/* ------------------------------------------------------------------ */

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "Approved" || status === "Active"
      ? " mh-sa__pill--ok"
      : status === "Pending" || status === "Upcoming"
        ? " mh-sa__pill--warn"
        : status === "Declined" || status === "Inactive"
          ? " ur-pill--declined"
          : "";
  return <span className={`mh-sa__pill${tone}`}>{status}</span>;
}

export function StudentCell({ student }: { student: StudentRef }) {
  return (
    <>
      <div className="ur-name">
        {student.name}
        {student.preferredName ? <span className="mh-sa__muted"> ({student.preferredName})</span> : null}
      </div>
      <div className="ur-sub">
        <Link href={studentHref(student.id)}>{student.studentNumber}</Link>
        {student.programCode ? <span className="ur-code">{student.programCode}</span> : null}
      </div>
    </>
  );
}

export function WorkshopCell({ w, href }: { w: { id: string; title: string; code: string }; href?: string }) {
  return (
    <>
      <div className="ur-name">{href === "" ? w.title : <Link href={href ?? `/admin/workshops/manage/${w.id}`}>{w.title}</Link>}</div>
      <div className="mh-sa__sub">{w.code}</div>
    </>
  );
}

export function Notices({ notice, error, onNotice, onError }: { notice: string | null; error: string | null; onNotice: () => void; onError: () => void }) {
  return (
    <>
      {notice ? (
        <div className="mh-sa__notice mh-sa__notice--success" role="status">
          <span>{notice}</span>
          <button type="button" onClick={onNotice} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="mh-sa__notice mh-sa__notice--error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onError} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}

export function Req({ label }: { label: string }) {
  return (
    <>
      <span className="ur-star">*</span> {label}
    </>
  );
}
