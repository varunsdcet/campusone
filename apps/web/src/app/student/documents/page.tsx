"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession } from "@/lib/api";
import { formatHccDate } from "@/lib/hccCourseFormat";

type DocRow = {
  id: string;
  recordName: string;
  recordDate: string | null;
  docLabel: string | null;
  downloadUrl: string | null;
  status: string;
};

function dateKey(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function StudentDocumentsPage() {
  const router = useRouter();
  const [name, setName] = useState("Student");
  const [items, setItems] = useState<DocRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameFilter, setNameFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setName(`${session.givenName} ${session.familyName}`.trim() || "Student");
    api<{ items: DocRow[] }>("/student/documents", {}, session.accessToken)
      .then((data) => setItems(data.items ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load documents"))
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    return items.filter((row) => {
      if (q) {
        const hay = `${row.recordName} ${row.docLabel ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const key = dateKey(row.recordDate);
      if (dateFrom && (!key || key < dateFrom)) return false;
      if (dateTo && (!key || key > dateTo)) return false;
      return true;
    });
  }, [items, nameFilter, dateFrom, dateTo]);

  return (
    <StudentSisShell title="" activeHref="/student/documents" userName={name}>
      <div className="mh-hcc-page mh-hcc-page--campus" data-stu="STU-DOC">
        <p className="mh-hcc-profile__crumb">
          Home <span>›</span> My Documents
        </p>
        <h1>MY DOCUMENTS</h1>

        <div className="mh-hcc-filters mh-hcc-filters--campus mh-hcc-filters--wrap">
          <label>
            <span>FILTER DOCUMENT NAME:</span>
            <input
              type="search"
              placeholder="Search by name"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
          </label>
          <label>
            <span>FROM DATE:</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            <span>TO DATE:</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
        </div>

        {error ? <p className="mh-teacher-muted" style={{ color: "#b42318" }}>{error}</p> : null}
        {loading && !error ? <p className="mh-teacher-muted">Loading documents…</p> : null}

        {!loading ? (
          <table className="mh-hcc-table mh-hcc-table--campus">
            <thead>
              <tr>
                <th>DOCUMENT NAME</th>
                <th>DATE</th>
                <th>LABEL</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>No documents match these filters.</td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.recordName}</strong>
                    </td>
                    <td>{formatHccDate(row.recordDate) || row.recordDate || "—"}</td>
                    <td>{row.docLabel || "—"}</td>
                    <td>
                      <span className="mh-hcc-status mh-hcc-status--done">{row.status}</span>
                    </td>
                    <td>
                      {row.downloadUrl ? (
                        <a className="mh-hcc-link" href={row.downloadUrl} target="_blank" rel="noreferrer">
                          Download
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : null}
      </div>
    </StudentSisShell>
  );
}
