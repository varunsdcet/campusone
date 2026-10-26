"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BASE, Empty, ErrorLine, StuFrame, fmtDate, profileHref, useLoad, useNotice, useStudentsMeta, type StudentsMeta } from "./kit";
import { AttendanceRecords, AuditTrail, ChangeStatus, FlagsHolds, NewProgramProfile, StudentOverview } from "./ProfileStatus";
import { Assessments, Correspondence, GenerateDocument, ReviewActions, Requirements } from "./ProfileComms";
import { EntryTests, FinalMarks, GenerateTranscript, PlanGate } from "./ProfileAcademic";
import { DisbursementsCredits, FinanceAudit, FinanceDocuments, FinancialOverview, FinancialTransactions, ManageInvoices, PaymentPlans, PromotionsAwards } from "./ProfileFinance";

export type Header = {
  id: string;
  name: string;
  preferredName: string;
  initials: string;
  applicationNumber: string;
  studentNumber: string;
  status: string;
  campus: string;
  program: string;
  schedule: string;
  startDate: string;
  endDate: string;
  cgpa: number | null;
  requirements: number;
  programProfiles: Array<{ id: string; studentNumber: string; program: string; current: boolean }>;
};

type Ctx = { id: string; header: Header; meta: StudentsMeta; reloadHeader: () => void; notice: ReturnType<typeof useNotice> };
const ProfileCtx = createContext<Ctx | null>(null);
export const useProfile = () => {
  const c = useContext(ProfileCtx);
  if (!c) throw new Error("useProfile outside profile");
  return c;
};

type Sub = { key: string; label: string; render: () => ReactNode };
const TABS: Array<{ key: string; label: string; subs: Sub[] }> = [
  {
    key: "status",
    label: "Status & Profile",
    subs: [
      { key: "overview", label: "Student Overview", render: () => <StudentOverview /> },
      { key: "flags", label: "Flags & Holds", render: () => <FlagsHolds /> },
      { key: "attendance", label: "Attendance Records", render: () => <AttendanceRecords /> },
      { key: "new-profile", label: "New Program Profile", render: () => <NewProgramProfile /> },
      { key: "change-status", label: "Change Status", render: () => <ChangeStatus /> },
      { key: "audit", label: "Audit Trail", render: () => <AuditTrail /> },
    ],
  },
  {
    key: "comms",
    label: "Communication & Workflows",
    subs: [
      { key: "document", label: "Generate Document", render: () => <GenerateDocument /> },
      { key: "correspondence", label: "Review Correspondence", render: () => <Correspondence /> },
      { key: "actions", label: "Review Actions", render: () => <ReviewActions /> },
      { key: "assessments", label: "Review Assessments", render: () => <Assessments /> },
      { key: "requirements", label: "Review Requirements", render: () => <Requirements /> },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    subs: [
      { key: "overview", label: "Financial Overview", render: () => <FinancialOverview /> },
      { key: "transactions", label: "Financial Transactions", render: () => <FinancialTransactions /> },
      { key: "invoices", label: "Manage Invoices", render: () => <ManageInvoices /> },
      { key: "disbursements", label: "Disbursements & Credits", render: () => <DisbursementsCredits /> },
      { key: "awards", label: "Promotions & Awards", render: () => <PromotionsAwards /> },
      { key: "plans", label: "Payment Plans & Collections", render: () => <PaymentPlans /> },
      { key: "documents", label: "Documents & Tax Forms", render: () => <FinanceDocuments /> },
      { key: "audit", label: "Audit Trail", render: () => <FinanceAudit /> },
    ],
  },
  {
    key: "grades",
    label: "Grades & Transcript",
    subs: [
      { key: "marks", label: "Manage / Review Final Marks", render: () => <FinalMarks /> },
      { key: "transcript", label: "Generate Transcript", render: () => <GenerateTranscript /> },
    ],
  },
  {
    key: "plan",
    label: "Program Plan",
    subs: [
      { key: "overview", label: "Plan Overview", render: () => <PlanGate view="overview" /> },
      { key: "customize", label: "Customize Plan", render: () => <PlanGate view="customize" /> },
      { key: "transfer", label: "Transfer & Challenges", render: () => <PlanGate view="transfer" /> },
      { key: "change", label: "Change / Drop Program", render: () => <PlanGate view="change" /> },
      { key: "completion", label: "Program Completion", render: () => <PlanGate view="completion" /> },
      { key: "tests", label: "Entry & Progress Tests", render: () => <EntryTests /> },
      { key: "export", label: "Export Plan", render: () => <PlanGate view="export" /> },
      { key: "audit", label: "Audit Trail", render: () => <PlanGate view="audit" /> },
    ],
  },
];

function ProfileHeader({ h }: { h: Header }) {
  const router = useRouter();
  const dates = h.startDate || h.endDate ? `${fmtDate(h.startDate)} – ${h.endDate ? fmtDate(h.endDate) : "—"}` : "";
  return (
    <header className="st-head">
      <span className="st-avatar st-avatar--lg" aria-hidden>
        {h.initials}
      </span>
      <div className="st-head__main">
        <h1>
          {h.name}
          {h.preferredName ? <span className="mh-sa__muted"> ({h.preferredName})</span> : null}
        </h1>
        <div className="st-head__meta">
          <span>
            Application #: <strong>{h.applicationNumber || "—"}</strong>
          </span>
          {h.studentNumber ? (
            <span>
              Student #: <strong>{h.studentNumber}</strong>
            </span>
          ) : null}
          <span>
            Status: <span className="st-pill">{h.status}</span>
          </span>
          <span>
            Campus: <strong>{h.campus || "—"}</strong>
          </span>
          <span>
            Program: <strong>{h.program || "—"}</strong>
          </span>
          {dates ? (
            <span>
              Schedule: <strong>{h.schedule ? `${h.schedule}, ` : ""}{dates}</strong>
            </span>
          ) : null}
        </div>
      </div>
      <div className="st-head__side">
        <span className="st-cgpa">
          CGPA<strong>{h.cgpa === null ? "—" : h.cgpa.toFixed(2)}</strong>
        </span>
        {h.programProfiles.length > 1 ? (
          <label className="mh-sa__muted" style={{ fontSize: 12 }}>
            Program profile{" "}
            <select className="mh-sa__input" value={h.id} onChange={(e) => router.push(profileHref(e.target.value))}>
              {h.programProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.studentNumber} — {p.program}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </header>
  );
}

export function StudentProfile() {
  const params = useParams<{ slug?: string[] }>();
  const router = useRouter();
  const [, rawId = "", tabKey = "status", subKey = ""] = params?.slug ?? [];
  const id = decodeURIComponent(rawId);
  const { meta, error: metaError } = useStudentsMeta();
  const { data: header, error, reload } = useLoad<Header>(id ? `/${encodeURIComponent(id)}/header` : null);
  const notice = useNotice();

  const tab = TABS.find((t) => t.key === tabKey);
  const sub = tab?.subs.find((s) => s.key === subKey);
  useEffect(() => {
    if (id && (!tab || !sub)) router.replace(profileHref(id, tab?.key ?? "status", (tab ?? TABS[0]!).subs[0]!.key));
  }, [id, tab, sub, router]);

  const crumb = header?.name ?? "Student";
  return (
    <StuFrame crumbs={[crumb, ...(tab && sub ? [tab.label, sub.label] : [])]} nav={`${BASE}/browse`}>
      <ErrorLine>{error ?? metaError}</ErrorLine>
      {notice.node}
      {!header || !meta ? (
        !error && !metaError ? <Empty>Loading…</Empty> : null
      ) : (
        <ProfileCtx.Provider value={{ id, header, meta, reloadHeader: reload, notice }}>
          <ProfileHeader h={header} />
          <nav className="lx-tabs pm-tabs st-tabs" aria-label="Student profile sections">
            {TABS.map((t) => (
              <Link key={t.key} href={profileHref(id, t.key, t.subs[0]!.key)} className={`lx-tab${t.key === tabKey && !(t.key === "comms" && subKey === "requirements" && header.requirements) ? " is-active" : ""}`} aria-current={t.key === tabKey ? "page" : undefined}>
                {t.label}
              </Link>
            ))}
            {header.requirements ? (
              <Link href={profileHref(id, "comms", "requirements")} className={`lx-tab st-tab--req${tabKey === "comms" && subKey === "requirements" ? " is-active" : ""}`}>
                Requirements ({header.requirements})
              </Link>
            ) : null}
          </nav>
          {tab ? (
            <nav className="st-subtabs" aria-label={`${tab.label} pages`}>
              {tab.subs.map((s) => (
                <Link key={s.key} href={profileHref(id, tab.key, s.key)} className={s.key === subKey ? "is-active" : ""} aria-current={s.key === subKey ? "page" : undefined}>
                  {s.label}
                </Link>
              ))}
            </nav>
          ) : null}
          {sub ? <div key={`${tabKey}/${subKey}`}>{sub.render()}</div> : null}
        </ProfileCtx.Provider>
      )}
    </StuFrame>
  );
}
