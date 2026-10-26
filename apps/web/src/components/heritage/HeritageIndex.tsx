"use client";

import "../superadmin/superadmin.css";
import "./heritage.css";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { ApiError, api, loadSession } from "@/lib/api";
import { heritageHref } from "@/lib/heritageNav";

type ScreenSummary = {
  id: string;
  name: string;
  screenType: string;
  mode: string;
  context: string | null;
  partial: boolean;
  status: string;
  dataPointCount: number;
  fields: number;
  filters: number;
  columns: number;
  actions: number;
  live: boolean;
  dedicated: string | null;
};
type Overview = {
  source: string;
  counts: { screens: number; dataPoints: number; flows: number; sidebarEntries: number; modules: number; openPoints: number };
  modules: Array<{ name: string; dataPointCount: number; screens: ScreenSummary[] }>;
};

export function HeritageIndex() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyLive, setOnlyLive] = useState(false);
  const [onlyPartial, setOnlyPartial] = useState(false);

  useEffect(() => {
    void api<Overview>("/admin/heritage/registry", {}, loadSession()?.accessToken)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the screen registry"));
  }, []);

  const modules = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.modules
      .map((m) => ({
        ...m,
        screens: m.screens.filter(
          (s) =>
            (!needle || `${s.id} ${s.name} ${s.screenType}`.toLowerCase().includes(needle)) &&
            (!onlyLive || s.live) &&
            (!onlyPartial || s.partial),
        ),
      }))
      .filter((m) => m.screens.length);
  }, [data, q, onlyLive, onlyPartial]);

  const liveCount = data?.modules.reduce((n, m) => n + m.screens.filter((s) => s.live).length, 0) ?? 0;

  return (
    <SuperFrame title="CampusOne SIS — Screen Index" breadcrumbs={["Home", "CampusOne SIS", "Screen Index"]} activeHref="/admin/heritage">
      <div className="hx hx-index mh-sa__stack">
        {error ? <SaNotice tone="error">{error}</SaNotice> : null}
        {!data ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : (
          <>
            <div className="hx-index__stats">
              {[
                ["Screens", data.counts.screens],
                ["Flows", data.counts.flows],
                ["Data points", data.counts.dataPoints],
                ["Sidebar entries", data.counts.sidebarEntries],
                ["Modules", data.counts.modules],
                ["Open points", data.counts.openPoints],
                ["Live-data screens", liveCount],
              ].map(([label, value]) => (
                <div key={label} className="hx-kpi">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="mh-sa__muted">Source: {data.source}</p>
            <div className="hx-listbar">
              <input className="mh-sa__input hx-quick" placeholder="Search screen ID or name…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search screens" />
              <label className="mh-sa__check">
                <input type="checkbox" checked={onlyLive} onChange={(e) => setOnlyLive(e.target.checked)} /> Live data only
              </label>
              <label className="mh-sa__check">
                <input type="checkbox" checked={onlyPartial} onChange={(e) => setOnlyPartial(e.target.checked)} /> Partial / open points only
              </label>
            </div>
            {modules.map((m) => (
              <section key={m.name} className="mh-sa__card hx-index__module">
                <h2>
                  <span>{m.name}</span>
                  <span className="mh-sa__muted">
                    {m.screens.length} screens · {m.dataPointCount} data points
                  </span>
                </h2>
                <div className="mh-sa__table-wrap">
                  <table className="mh-sa__table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Screen</th>
                        <th>Type</th>
                        <th>Engine</th>
                        <th>Data points</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.screens.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <code>{s.id}</code>
                          </td>
                          <td>
                            <Link className="mh-sa__link" href={heritageHref(s.id)}>
                              {s.name}
                            </Link>
                            {s.dedicated ? (
                              <>
                                {" · "}
                                <Link className="mh-sa__link" href={s.dedicated}>
                                  dedicated
                                </Link>
                              </>
                            ) : null}
                          </td>
                          <td>{s.screenType}</td>
                          <td>
                            {s.mode}
                            {s.context ? ` · per ${s.context}` : ""}
                          </td>
                          <td>
                            {s.dataPointCount}
                            <span className="mh-sa__muted">
                              {" "}
                              ({s.fields}f/{s.filters}q/{s.columns}c/{s.actions}a)
                            </span>
                          </td>
                          <td>
                            <span className={`mh-sa__pill${s.partial ? " mh-sa__pill--warn" : " mh-sa__pill--ok"}`}>{s.partial ? "Partial" : "Captured"}</span>
                            {s.live ? <span className="hx-live">live</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </SuperFrame>
  );
}
