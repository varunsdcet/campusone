"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExecutiveMetricsSnapshot } from "@myheritage/contracts";
import { Banner, StatusPill } from "@myheritage/ui";
import { api, loadSession } from "@/lib/api";
import { ScreenScaffold } from "@/components/ScreenScaffold";

export default function AdminExecutivePage() {
  const router = useRouter();
  const [data, setData] = useState<ExecutiveMetricsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    api<{ executiveMetrics: ExecutiveMetricsSnapshot }>("/ai/executive-metrics", {}, session.accessToken)
      .then((payload) => setData(payload.executiveMetrics))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load executive metrics"));
  }, [router]);

  return (
    <ScreenScaffold
      role="admin"
      title="Executive intelligence"
      subtitle="Controlled enrollment and academic KPIs"
      breadcrumb={["Admin", "Executive intelligence"]}
      active="/admin/ai/executive"
    >
      <div className="mh-student-stack">
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {!data && !error ? <p>Loading executive metrics…</p> : null}
        {data ? (
          <>
            <div className="mh-sis-dash__kpis">
              <div className="mh-sis-dash__kpi">
                <div className="mh-sis-dash__kpi-label">Students</div>
                <div className="mh-sis-dash__kpi-value">{data.enrollment.studentCount}</div>
              </div>
              <div className="mh-sis-dash__kpi">
                <div className="mh-sis-dash__kpi-label">Enrolments</div>
                <div className="mh-sis-dash__kpi-value">{data.enrollment.enrolmentCount}</div>
              </div>
              <div className="mh-sis-dash__kpi">
                <div className="mh-sis-dash__kpi-label">Open success cases</div>
                <div className="mh-sis-dash__kpi-value">{data.academic.openSuccessCases}</div>
              </div>
              <div className="mh-sis-dash__kpi">
                <div className="mh-sis-dash__kpi-label">Advising requests</div>
                <div className="mh-sis-dash__kpi-value">{data.academic.advisingRequested}</div>
              </div>
            </div>
            <section className="mh-sis-dash__card" style={{ marginTop: 20 }}>
              <h2>Academic operations</h2>
              <p>
                Published grades: {data.academic.publishedGradeCount} · Draft grades: {data.academic.draftGradeCount}{" "}
                <StatusPill tone="neutral">{data.source}</StatusPill>
              </p>
              <h3>Enrollment by program</h3>
              <ul>
                {data.enrollment.byProgram.map((row) => (
                  <li key={row.programCode}>
                    {row.programName} ({row.programCode}): {row.studentCount}
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}
      </div>
    </ScreenScaffold>
  );
}
