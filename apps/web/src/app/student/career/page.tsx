"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession } from "@/lib/api";
import { careerCoachingHref, opportunityApplicationHref } from "@/lib/careerFlow";

type Opportunity = {
  id: string;
  title: string;
  employerName: string;
  skills: string[];
  programCodes: string[];
  status: string;
  href: string | null;
  updatedAt: string;
};

type ServiceLink = {
  title: string;
  body: string;
  href: string;
  cta: string;
};

type Payload = {
  opportunities: Opportunity[];
  services: ServiceLink[];
};

export default function CareerPage() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailFocusRequest, setDetailFocusRequest] = useState<{ id: string; sequence: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Student");
  const detailRef = useRef<HTMLElement>(null);
  const detailSequence = useRef(0);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setName(`${session.givenName} ${session.familyName}`.trim() || "Student");
    api<Payload>("/student/career", {}, session.accessToken)
      .then((payload) => {
        setData(payload);
        setSelectedId(payload.opportunities.find((o) => o.status === "open")?.id ?? payload.opportunities[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [router]);

  const selected = useMemo(
    () => data?.opportunities.find((o) => o.id === selectedId) ?? null,
    [data, selectedId],
  );
  const selectedApplicationHref = opportunityApplicationHref(selected?.href);
  const openCount = data?.opportunities.filter((o) => o.status === "open").length ?? 0;

  useEffect(() => {
    if (!detailFocusRequest || detailFocusRequest.id !== selectedId) return;

    const frame = window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      detailRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [detailFocusRequest, selectedId]);

  function go(href: string) {
    if (href.startsWith("https://")) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    if (href.startsWith("/") && !href.startsWith("//")) router.push(href);
  }

  function showDetails(id: string) {
    setSelectedId(id);
    detailSequence.current += 1;
    setDetailFocusRequest({ id, sequence: detailSequence.current });
  }

  return (
    <StudentSisShell
      title="Career services"
      subtitle="Coaching, co-op roles, and work-integrated learning for your program"
      activeHref="/student/career"
      userName={name}
    >
      <div className="mh-teacher-stack">
        {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}

        <section className="mh-teacher-card">
          <div className="mh-teacher-card__head">
            <h2>At a glance</h2>
          </div>
          <div className="mh-teacher-list">
            <div className="mh-teacher-list__item">
              <div>
                <strong>{openCount} open role{openCount === 1 ? "" : "s"}</strong>
                <span>Approved opportunities posted for CampusOne students</span>
              </div>
              <span className="mh-teacher-badge is-active">Live</span>
            </div>
            <div className="mh-teacher-list__item">
              <div>
                <strong>Career coaching</strong>
                <span>Request resume, interview, and job-search support from an advisor</span>
              </div>
              <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" onClick={() => go(careerCoachingHref())}>
                Book coaching
              </button>
            </div>
          </div>
        </section>

        <section className="mh-teacher-card">
          <div className="mh-teacher-card__head">
            <h2>Open opportunities</h2>
            <span className="mh-teacher-muted">{data?.opportunities.length ?? 0}</span>
          </div>
          {!data && !error ? <p className="mh-teacher-muted">Loading career opportunities…</p> : null}
          <div className="mh-teacher-list">
            {(data?.opportunities ?? []).map((o) => {
              const applicationHref = opportunityApplicationHref(o.href);
              return (
                <div key={o.id} className="mh-teacher-list__item">
                  <div>
                    <strong>{o.title}</strong>
                    <span>
                      {o.employerName}
                      {o.skills.length ? ` · ${o.skills.join(", ")}` : ""}
                      {o.programCodes.length ? ` · ${o.programCodes.join(", ")}` : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className={`mh-teacher-badge ${o.status === "open" ? "is-active" : "is-muted"}`}>{o.status}</span>
                    <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => showDetails(o.id)}>
                      Details
                    </button>
                    <button
                      type="button"
                      className="mh-teacher-btn mh-teacher-btn--primary"
                      disabled={!applicationHref}
                      onClick={() => applicationHref && go(applicationHref)}
                      title={applicationHref ? "Open application" : "No application link has been provided"}
                    >
                      {applicationHref ? "Express interest" : "Application unavailable"}
                    </button>
                  </div>
                </div>
              );
            })}
            {data && !data.opportunities.length ? (
              <p className="mh-teacher-muted">No career opportunities posted yet. Check back soon or message Career Services.</p>
            ) : null}
          </div>
        </section>

        {selected ? (
          <section
            ref={detailRef}
            id={`career-opportunity-${selected.id}`}
            className="mh-teacher-card"
            tabIndex={-1}
            aria-labelledby={`career-opportunity-title-${selected.id}`}
            style={{ scrollMarginTop: 24 }}
          >
            <div className="mh-teacher-card__head">
              <h2 id={`career-opportunity-title-${selected.id}`}>{selected.title}</h2>
              <span className={`mh-teacher-badge ${selected.status === "open" ? "is-active" : "is-muted"}`}>{selected.status}</span>
            </div>
            <div className="mh-teacher-list">
              <div className="mh-teacher-list__item">
                <div>
                  <strong>{selected.employerName}</strong>
                  <span>Employer partner · updated {new Date(selected.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
              {selected.skills.length ? (
                <div className="mh-teacher-list__item">
                  <div>
                    <strong>Skills</strong>
                    <span>{selected.skills.join(" · ")}</span>
                  </div>
                </div>
              ) : null}
              {selected.programCodes.length ? (
                <div className="mh-teacher-list__item">
                  <div>
                    <strong>Program fit</strong>
                    <span>{selected.programCodes.join(" · ")}</span>
                  </div>
                </div>
              ) : null}
              <div className="mh-teacher-list__item">
                <div>
                  <strong>Next step</strong>
                  <span>
                    {selectedApplicationHref
                      ? "Open the approved application link, or explore related practicum / WIL pathways."
                      : "No application link is available for this opportunity. You can still explore related practicum / WIL pathways."}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="mh-teacher-btn mh-teacher-btn--primary"
                    disabled={!selectedApplicationHref}
                    onClick={() => selectedApplicationHref && go(selectedApplicationHref)}
                    title={selectedApplicationHref ? "Open application" : "No application link has been provided"}
                  >
                    {selectedApplicationHref ? "Express interest" : "Application unavailable"}
                  </button>
                  <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => go("/student/f/st-17-practicum")}>
                    View practicum
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mh-teacher-card">
          <div className="mh-teacher-card__head">
            <h2>Career services</h2>
          </div>
          <div className="mh-teacher-list">
            {(data?.services ?? []).map((s) => (
              <div key={s.title} className="mh-teacher-list__item">
                <div>
                  <strong>{s.title}</strong>
                  <span>{s.body}</span>
                </div>
                <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => go(s.href)}>
                  {s.cta}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </StudentSisShell>
  );
}
