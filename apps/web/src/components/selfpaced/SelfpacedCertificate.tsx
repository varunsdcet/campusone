"use client";

import { useMemo } from "react";

export type CertificateProps = {
  learnerName: string;
  programTitle: string;
  hours: number;
  chapters: number;
  issuedAt: string;
  certificateId: string;
  onPrint?: () => void;
  /** Compact card for sidebar / sticky preview. */
  compact?: boolean;
  /** Show as locked preview before the learner finishes the course. */
  locked?: boolean;
};

export function SelfpacedCertificate({
  learnerName,
  programTitle,
  hours,
  chapters,
  issuedAt,
  certificateId,
  onPrint,
  compact = false,
  locked = false,
}: CertificateProps) {
  const dateLabel = useMemo(() => {
    const d = new Date(issuedAt);
    if (Number.isNaN(d.getTime())) return issuedAt;
    return d.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [issuedAt]);

  if (compact) {
    return (
      <article
        className={`sp-cert-mini${locked ? " is-locked" : ""}`}
        aria-label={locked ? "Certificate preview (locked)" : "Certificate of completion"}
      >
        <img src="/brand/campusone/logo.png" alt="" className="sp-cert-mini__logo" />
        <p className="sp-cert-mini__eyebrow">{locked ? "Certificate · Locked" : "Certificate of Completion"}</p>
        <p className="sp-cert-mini__name">{learnerName}</p>
        <p className="sp-cert-mini__program">{programTitle}</p>
        <p className="sp-cert-mini__meta">
          {hours.toFixed(0)} hrs · {chapters} chapters
          {locked ? " · Finish to unlock" : ` · ${dateLabel}`}
        </p>
        <p className="sp-cert-mini__id">{locked ? "ID issues when you complete" : certificateId}</p>
      </article>
    );
  }

  return (
    <div className={`sp-cert${locked ? " is-locked" : ""}`}>
      {!locked ? (
        <div className="sp-cert__actions no-print">
          <button type="button" className="sp-btn sp-btn--primary" onClick={onPrint || (() => window.print())}>
            Print / Save PDF
          </button>
        </div>
      ) : null}

      <div className="sp-cert__stage">
        <div className="sp-cert__frame" aria-label="Course completion certificate">
          <div className="sp-cert__inner">
            <span className="sp-cert__corner sp-cert__corner--tl" aria-hidden />
            <span className="sp-cert__corner sp-cert__corner--tr" aria-hidden />
            <span className="sp-cert__corner sp-cert__corner--bl" aria-hidden />
            <span className="sp-cert__corner sp-cert__corner--br" aria-hidden />

            {locked ? <span className="sp-cert__watermark" aria-hidden>LOCKED</span> : null}

            <img src="/brand/campusone/logo.png" alt="CampusOne" className="sp-cert__logo" />

            <p className="sp-cert__brand">CampusOne</p>
            <h1 className="sp-cert__heading">Certificate of Completion</h1>
            <p className="sp-cert__subtitle">This certificate is proudly presented to</p>
            <div className="sp-cert__divider" aria-hidden />

            <p className="sp-cert__student">{learnerName || "[ Student Name ]"}</p>

            <p className="sp-cert__course-line">for successfully completing the course</p>
            <p className="sp-cert__course">{programTitle || "[ Course Name ]"}</p>
            {!locked ? (
              <p className="sp-cert__hours">
                {hours.toFixed(0)} instructional hours · {chapters} chapters · Certificate ID {certificateId}
              </p>
            ) : (
              <p className="sp-cert__hours">Finish the course to unlock print &amp; verification</p>
            )}

            <div className="sp-cert__signs">
              <div className="sp-cert__sign">
                <div className="sp-cert__sign-line">
                  <span className="sp-cert__sign-value">{locked ? "[ Date ]" : dateLabel}</span>
                </div>
                <span className="sp-cert__sign-label">Date</span>
              </div>
              <div className="sp-cert__sign">
                <div className="sp-cert__sign-line">
                  <span className="sp-cert__sign-value">{locked ? "[ Instructor / Director ]" : "Academic Services"}</span>
                </div>
                <span className="sp-cert__sign-label">Signature</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
