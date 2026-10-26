"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaField, SuperFrame } from "@/components/superadmin/shared";
import { Notices, StatusPill, WorkshopCell, dateRange, errMsg, money, useMeta, ws, type WorkshopSummary } from "./common";

function useList(path: string) {
  const [items, setItems] = useState<WorkshopSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setItems(null);
    ws<{ items: WorkshopSummary[] }>(path)
      .then((r) => {
        setItems(r.items);
        setError(null);
      })
      .catch((e) => setError(errMsg(e, "Could not load workshops")));
  }, [path]);
  return { items, error, setError };
}

/* ------------------------------------------------------------------ */
/* Screen 4 — ALL MY WORKSHOPS                                          */
/* ------------------------------------------------------------------ */

export function MyWorkshops() {
  const router = useRouter();
  const sp = useSearchParams();
  const meta = useMeta();
  const filter = sp?.get("filter") || "Active & Upcoming Workshops";
  const { items, error, setError } = useList(`/mine?filter=${encodeURIComponent(filter)}`);

  return (
    <SuperFrame title="ALL MY WORKSHOPS" breadcrumbs={["Home", "All My Workshops"]} breadcrumbHrefs={["/admin"]} activeHref="/admin/workshops/mine">
      <div className="ur">
        <Notices notice={null} error={error} onNotice={() => undefined} onError={() => setError(null)} />
        <section className="mh-sa__card">
          <div className="wk-toolbar">
            <SaField label="Filter Status">
              <select
                className="mh-sa__input mh-sa__input--auto"
                value={filter}
                onChange={(e) => router.push(`/admin/workshops/mine?${new URLSearchParams({ filter: e.target.value }).toString()}`)}
              >
                {(meta?.options.myFilters ?? ["Active & Upcoming Workshops", "Active Workshops", "Upcoming Workshops", "Completed Workshops"]).map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </SaField>
          </div>
          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table">
              <thead>
                <tr>
                  <th>Workshop</th>
                  <th>Instructor(s)</th>
                  <th>Status</th>
                  <th>Length</th>
                  <th>Dates</th>
                  <th>Schedule</th>
                </tr>
              </thead>
              <tbody>
                {!items ? (
                  <tr>
                    <td colSpan={6} className="mh-sa__empty-cell">
                      {error ? "—" : "Loading workshops…"}
                    </td>
                  </tr>
                ) : !items.length ? (
                  <tr>
                    <td colSpan={6} className="mh-sa__empty-cell">
                      No workshops were found.
                    </td>
                  </tr>
                ) : (
                  items.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <WorkshopCell w={w} />
                      </td>
                      <td>{w.instructors.join(", ") || "—"}</td>
                      <td>
                        <StatusPill status={w.status} />
                      </td>
                      <td className="ur-nowrap">{w.length}</td>
                      <td className="ur-nowrap">{dateRange(w)}</td>
                      <td>{w.schedule}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 5 — AVAILABLE WORKSHOPS                                       */
/* ------------------------------------------------------------------ */

export function AvailableWorkshops() {
  const { items, error, setError } = useList("/available");
  return (
    <SuperFrame
      title="AVAILABLE WORKSHOPS"
      breadcrumbs={["Home", "All My Workshops", "Available Workshops"]}
      breadcrumbHrefs={["/admin", "/admin/workshops/mine"]}
      activeHref="/admin/workshops/available"
    >
      <div className="ur">
        <Notices notice={null} error={error} onNotice={() => undefined} onError={() => setError(null)} />
        {!items ? (
          error ? null : <p className="mh-sa__muted">Loading available workshops…</p>
        ) : !items.length ? (
          <section className="mh-sa__card">
            <p className="mh-sa__empty">No available workshops were found.</p>
          </section>
        ) : (
          <section className="mh-sa__card">
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table">
                <thead>
                  <tr>
                    <th>Workshop</th>
                    <th>Instructor(s)</th>
                    <th>Dates</th>
                    <th>Schedule</th>
                    <th>Seats</th>
                    <th>Fee</th>
                    <th className="ur-col-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <WorkshopCell w={w} />
                        {w.category ? <div className="mh-sa__sub">{w.category}</div> : null}
                      </td>
                      <td>{w.instructors.join(", ") || "—"}</td>
                      <td className="ur-nowrap">{dateRange(w)}</td>
                      <td>{w.schedule}</td>
                      <td className="ur-nowrap">
                        {w.seatsLeft} of {w.capacity} left
                      </td>
                      <td className="ur-nowrap">{w.fee > 0 ? money(w.fee) : "Free"}</td>
                      <td className="ur-col-actions">
                        <span className="ur-actions">
                          <Link href={`/admin/workshops/manage/${w.id}`}>VIEW</Link>
                          <span aria-hidden>|</span>
                          <Link href={`/admin/workshops/enrol?workshop=${w.id}`}>ENROL USER</Link>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 6 — COMPLETED WORKSHOPS                                       */
/* ------------------------------------------------------------------ */

export function CompletedWorkshops() {
  const { items, error, setError } = useList("/completed");
  return (
    <SuperFrame
      title="COMPLETED WORKSHOPS"
      breadcrumbs={["Home", "All My Workshops", "Completed Workshops"]}
      breadcrumbHrefs={["/admin", "/admin/workshops/mine"]}
      activeHref="/admin/workshops/completed"
    >
      <div className="ur">
        <Notices notice={null} error={error} onNotice={() => undefined} onError={() => setError(null)} />
        {!items ? (
          error ? null : <p className="mh-sa__muted">Loading completed workshops…</p>
        ) : !items.length ? (
          <section className="mh-sa__card">
            <p className="mh-sa__empty">No completed workshops were found.</p>
          </section>
        ) : (
          <section className="mh-sa__card">
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table">
                <thead>
                  <tr>
                    <th>Workshop</th>
                    <th>Instructor(s)</th>
                    <th>Length</th>
                    <th>Dates</th>
                    <th>Participants</th>
                    <th className="ur-col-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <WorkshopCell w={w} />
                      </td>
                      <td>{w.instructors.join(", ") || "—"}</td>
                      <td className="ur-nowrap">{w.length}</td>
                      <td className="ur-nowrap">{dateRange(w)}</td>
                      <td className="ur-nowrap">{w.counts.approved}</td>
                      <td className="ur-col-actions">
                        <span className="ur-actions">
                          <Link href={`/admin/workshops/manage/${w.id}`}>VIEW</Link>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </SuperFrame>
  );
}
