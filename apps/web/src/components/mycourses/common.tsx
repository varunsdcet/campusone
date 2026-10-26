"use client";

import "../superadmin/superadmin.css";
import "../requests/requests.css";
import "../workshops/workshops.css";
import "./mycourses.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, api, loadSession } from "@/lib/api";
import { offeringHref } from "@/lib/myCoursesNav";

export const mc = <T,>(path: string, init?: RequestInit) => api<T>(`/admin/heritage/my-courses${path}`, init ?? {}, loadSession()?.accessToken);
export const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback);
export const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export type Option = { value: string; label: string };
export type ScheduleDay = { day: string; start: string; end: string };
export type Offering = {
  id: string;
  courseId: string;
  code: string;
  offering: string;
  title: string;
  term: string;
  dates: string;
  datesWithWeekday: string;
  days: ScheduleDay[];
  location: string;
  delivery: string;
  enrolled: number;
  status: string;
};

export { offeringHref };

/** Loads `path`, re-fetching whenever it changes. */
export function useMc<T>(path: string, fallback: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    mc<T>(path)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e, fallback));
      });
    return () => {
      cancelled = true;
    };
  }, [path, fallback]);
  return { data, error, setError };
}

export function CourseCell({
  o,
  sectionId,
  role,
  offeringBelow,
}: {
  o: Pick<Offering, "id" | "code" | "offering" | "title">;
  /** Rows that are not themselves offerings (e.g. approval requests) name their offering here. */
  sectionId?: string;
  role?: string;
  offeringBelow?: boolean;
}) {
  return (
    <>
      <div className="ur-name">
        <Link href={offeringHref(sectionId ?? o.id)}>{offeringBelow ? o.code : `${o.code} (${o.offering})`}</Link>
      </div>
      <div>{o.title}</div>
      {offeringBelow ? <div className="mh-sa__sub">{o.offering}</div> : null}
      {role ? <div className="mh-sa__sub mc-role">{role}</div> : null}
    </>
  );
}

export function ScheduleCell({ dates, days }: { dates?: string; days: ScheduleDay[] }) {
  return (
    <>
      {dates ? <div className="ur-nowrap">{dates}</div> : null}
      {days.map((d) => (
        <div key={d.day} className="mh-sa__sub ur-nowrap">
          {d.day}: {d.start}
          {d.end ? ` – ${d.end}` : ""}
        </div>
      ))}
    </>
  );
}

export function ErrorNotice({ error, onClose }: { error: string | null; onClose: () => void }) {
  if (!error) return null;
  return (
    <div className="mh-sa__notice mh-sa__notice--error" role="alert">
      <span>{error}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

export function TableState({ cols, loading, error, empty }: { cols: number; loading: boolean; error: string | null; empty: string }) {
  return (
    <tr>
      <td colSpan={cols} className="mh-sa__empty-cell">
        {loading ? (error ? "—" : "Loading…") : empty}
      </td>
    </tr>
  );
}
