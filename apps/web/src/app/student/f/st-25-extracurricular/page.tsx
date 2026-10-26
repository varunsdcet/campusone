"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession } from "@/lib/api";

type Rec = {
  id: string;
  termCode: string | null;
  category: string;
  title: string;
  detail: string | null;
  status: string;
};

type Payload = {
  records: Rec[];
  categories: string[];
  terms: string[];
};

export default function ExtracurricularPage() {
  const router = useRouter();
  const [records, setRecords] = useState<Rec[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [terms, setTerms] = useState<string[]>([]);
  const [termFilter, setTermFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Student");

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setName(`${session.givenName} ${session.familyName}`.trim() || "Student");
    api<Payload>("/student/extracurricular", {}, session.accessToken)
      .then((extra) => {
        setRecords(extra.records);
        setCategories(extra.categories ?? []);
        setTerms(extra.terms ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [router]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (termFilter !== "all" && (r.termCode || "") !== termFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      return true;
    });
  }, [records, termFilter, categoryFilter]);

  return (
    <StudentSisShell title="" activeHref="/student/f/st-25-extracurricular" userName={name}>
      <div className="mh-hcc-page mh-hcc-page--campus" data-stu="STU-18">
        <p className="mh-hcc-profile__crumb">
          Home <span>›</span> My Records <span>›</span> Extracurricular Records
        </p>
        <h1>EXTRACURRICULAR RECORDS</h1>

        <div className="mh-hcc-filters mh-hcc-filters--campus">
          <label>
            <span>FILTER TERM:</span>
            <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
              <option value="all">All Terms</option>
              {terms.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>FILTER CATEGORY:</span>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <p className="mh-teacher-muted" style={{ color: "#b42318" }}>{error}</p> : null}

        <table className="mh-hcc-table mh-hcc-table--campus">
          <thead>
            <tr>
              <th>RECORD</th>
              <th>CATEGORY</th>
              <th>TERM</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4}>No extracurricular records match these filters.</td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.title}</strong>
                    {r.detail ? <div className="mh-hcc-course-title">{r.detail}</div> : null}
                  </td>
                  <td>{r.category}</td>
                  <td>{r.termCode || "—"}</td>
                  <td>
                    <span className="mh-hcc-status mh-hcc-status--done">{r.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </StudentSisShell>
  );
}
