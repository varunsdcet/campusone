"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession } from "@/lib/api";

type Badge = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: string;
  earnedAt: string | null;
};

function AccomplishmentsInner() {
  const router = useRouter();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Student");

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setName(`${session.givenName} ${session.familyName}`.trim() || "Student");
    api<{ badges: Badge[] }>("/student/badges", {}, session.accessToken)
      .then((d) => setBadges(d.badges ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load accomplishments"));
  }, [router]);

  return (
    <StudentSisShell title="" activeHref="/student/accomplishments" userName={name}>
      <div className="mh-hcc-page" data-stu="STU-17">
        <p className="mh-hcc-profile__crumb">
          Home <span>›</span> My Records <span>›</span> Accomplishments &amp; Badges
        </p>
        <h1>MY ACCOMPLISHMENTS &amp; BADGES</h1>
        {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
        <table className="mh-hcc-table">
          <thead>
            <tr>
              <th>ACCOMPLISHMENT / BADGE</th>
              <th>CODE</th>
              <th>STATUS</th>
              <th>EARNED</th>
            </tr>
          </thead>
          <tbody>
            {badges.length === 0 ? (
              <tr>
                <td colSpan={4}>No accomplishments or badges yet.</td>
              </tr>
            ) : (
              badges.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>{b.title}</strong>
                    {b.description ? <em>{b.description}</em> : null}
                  </td>
                  <td>{b.code}</td>
                  <td>
                    <span className="mh-hcc-pill">{b.status}</span>
                  </td>
                  <td>{b.earnedAt ? new Date(b.earnedAt).toLocaleDateString() : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </StudentSisShell>
  );
}

export default function AccomplishmentsPage() {
  return (
    <Suspense fallback={null}>
      <AccomplishmentsInner />
    </Suspense>
  );
}
