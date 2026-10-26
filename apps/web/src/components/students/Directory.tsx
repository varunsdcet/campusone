"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BASE,
  Btn,
  Card,
  Empty,
  ErrorLine,
  F,
  Filters,
  Letters,
  PagerFor,
  Sel,
  SourceNotice,
  StuFrame,
  Table,
  Txt,
  fmtStamp,
  profileHref,
  stu,
  qs,
  usePaging,
  useStudentsMeta,
  type Paged,
  type StudentsMeta,
} from "./kit";

type DirRow = {
  id: string;
  name: string;
  initials: string;
  studentNumber: string;
  applicationNumber: string;
  status: string;
  advisors: string[];
  program: string;
  programTerm: string;
  admissionTerm: string;
  createdAt: string;
  /** Set for applicant leads (no student record yet): they open in Admissions, not the student profile. */
  href?: string;
};

const rowHref = (r: DirRow) => r.href || profileHref(r.id);
const statusTone = (status: string) => {
  const value = status.toLowerCase();
  if (value.includes("active") || value.includes("registered")) return "is-positive";
  if (value.includes("hold") || value.includes("leave")) return "is-warning";
  if (value.includes("withdraw") || value.includes("dismiss")) return "is-danger";
  if (value.includes("graduat")) return "is-complete";
  return "is-neutral";
};

const BASIC = ["campus", "program", "pathway", "schedule", "programTerm", "admissionTerm", "nationality", "status", "agent", "advisor", "startDate", "endDate"] as const;
const ADVANCED = ["sisEmail", "lastName", "firstName", "middleName", "preferredName", "dobMonth", "dobDay", "dobYear", "residency", "street", "city", "postal", "phone", "email", "discountCode", "delivery"] as const;
type Criteria = Record<string, string>;

function criteriaFrom(sp: URLSearchParams | null): Criteria {
  const out: Criteria = {};
  if (!sp) return out;
  for (const k of [...BASIC, ...ADVANCED, "q"]) {
    const v = sp.get(k);
    if (v) out[k] = v;
  }
  const status = sp.get("f.status");
  if (status) out.status = status;
  return out;
}

function BasicFilters({ meta, value, set }: { meta: StudentsMeta; value: Criteria; set: (k: string, v: string) => void }) {
  const v = (k: string) => value[k] ?? "";
  const pathways = meta.pathways.filter((p) => !v("program") || meta.programs.find((x) => x.name === v("program"))?.id === p.program);
  const schedules = meta.schedules.filter((s) => !v("program") || meta.programs.find((x) => x.name === v("program"))?.id === s.program);
  return (
    <>
      <F label="Campus Filter">
        <Sel value={v("campus")} onChange={(x) => set("campus", x)} empty="All Campuses" options={meta.campuses} />
      </F>
      <F label="Program Filter">
        <Sel value={v("program")} onChange={(x) => set("program", x)} empty="All Programs" options={meta.programs.map((p) => p.name)} />
      </F>
      <F label="Pathway Filter">
        <Sel value={v("pathway")} onChange={(x) => set("pathway", x)} empty="All Pathways" options={[...new Set(pathways.map((p) => p.name))]} />
      </F>
      <F label="Schedule Filter">
        <Sel value={v("schedule")} onChange={(x) => set("schedule", x)} empty="All Schedules" options={[...new Set(schedules.map((s) => s.name).filter(Boolean))]} />
      </F>
      <F label="Program Term Filter">
        <Sel value={v("programTerm")} onChange={(x) => set("programTerm", x)} empty="All Program Terms" options={meta.admissionTerms} />
      </F>
      <F label="Admission Term Filter">
        <Sel value={v("admissionTerm")} onChange={(x) => set("admissionTerm", x)} empty="All Admission Terms" options={meta.admissionTerms} />
      </F>
      <F label="Nationality Filter">
        <Sel value={v("nationality")} onChange={(x) => set("nationality", x)} empty="All Nationalities" options={meta.countries.map((c) => c.name)} />
      </F>
      <F label="Status Filter">
        <Sel value={v("status")} onChange={(x) => set("status", x)} empty="All Statuses" options={meta.statuses} />
      </F>
      <F label="Agent Filter">
        <Sel value={v("agent")} onChange={(x) => set("agent", x)} empty="All Agents" options={meta.agents.map((a) => ({ value: a.id, label: a.name }))} />
      </F>
      <F label="Advisor Filter">
        <Sel value={v("advisor")} onChange={(x) => set("advisor", x)} empty="All Advisors" options={meta.advisors.map((a) => ({ value: a.id, label: a.name }))} />
      </F>
      <F label="Start Date Filter">
        <Txt type="date" value={v("startDate")} onChange={(x) => set("startDate", x)} />
      </F>
      <F label="End Date Filter">
        <Txt type="date" value={v("endDate")} onChange={(x) => set("endDate", x)} />
      </F>
    </>
  );
}

function Results({ criteria, run }: { criteria: Criteria; run: number }) {
  const paging = usePaging(25);
  const [letter, setLetter] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [data, setData] = useState<Paged<DirRow> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    paging.reset();
    setChecked(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, letter]);

  useEffect(() => {
    let live = true;
    setError(null);
    stu<Paged<DirRow>>(`/directory${qs({ ...criteria, letter, dir, page: paging.page, perPage: paging.perPage })}`)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Could not load students"));
    return () => {
      live = false;
    };
  }, [criteria, run, letter, dir, paging.page, paging.perPage]);

  const all = data?.items ?? [];
  const allOn = all.length > 0 && all.every((r) => checked.has(r.id));
  const toggle = (id: string, on: boolean) =>
    setChecked((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <Card>
      <Letters value={letter} onChange={setLetter} />
      <ErrorLine>{error}</ErrorLine>
      <PagerFor data={data} paging={paging} />
      <Table
        head={[
          <input key="all" type="checkbox" aria-label="Select all" checked={allOn} onChange={(e) => setChecked(e.target.checked ? new Set(all.map((r) => r.id)) : new Set())} />,
          "",
          <button key="name" type="button" className="st-link" onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))} aria-label={`Sort by name ${dir === "asc" ? "descending" : "ascending"}`}>
            Name {dir === "asc" ? "▲" : "▼"}
          </button>,
          "Student #",
          "Status",
          "Advisors",
          "Program",
          "Program Term",
          "Admission Term",
          "Date",
          "",
        ]}
        empty={data ? "No students were found matching your search criteria." : false}
      >
        {all.map((r) => (
          <tr key={r.id}>
            <td className="st-row-sel">
              <input type="checkbox" aria-label={`Select ${r.name}`} checked={checked.has(r.id)} onChange={(e) => toggle(r.id, e.target.checked)} />
            </td>
            <td>
              <span className="st-avatar" aria-hidden>
                {r.initials}
              </span>
            </td>
            <td>
              <Link href={rowHref(r)}>{r.name}</Link>
            </td>
            <td>{r.studentNumber || "—"}</td>
            <td>
              <span className={`st-status ${statusTone(r.status)}`}>{r.status}</span>
            </td>
            <td>{r.advisors.join(", ") || "—"}</td>
            <td>{r.program || "—"}</td>
            <td>{r.programTerm || "—"}</td>
            <td>{r.admissionTerm || "—"}</td>
            <td>{fmtStamp(r.createdAt)}</td>
            <td className="st-right">
              <Link href={rowHref(r)} className="mh-sa__btn mh-sa__btn--sm">
                VIEW
              </Link>
            </td>
          </tr>
        ))}
      </Table>
      <div className="st-withchecked">
        <span className="mh-sa__label">With checked</span>
        <select className="mh-sa__input" aria-label="With checked" value="" disabled>
          <option value="">{checked.size ? `${checked.size} selected` : "Select students first"}</option>
        </select>
      </div>
      {checked.size ? (
        <SourceNotice>
          The &quot;With checked&quot; operation list was not opened in the captured directory screen, so no row actions are offered here. Use <Link href={`${BASE}/bulk`}>Bulk / Group Actions</Link> for multi-student operations.
        </SourceNotice>
      ) : null}
    </Card>
  );
}

/** Browse All Students and every status directory (status comes from `?f.status=`). */
export function StudentDirectory() {
  const sp = useSearchParams();
  const router = useRouter();
  const { meta, error } = useStudentsMeta();
  const fromUrl = useMemo(() => criteriaFrom(sp), [sp]);
  const status = sp?.get("f.status") ?? "";
  const [draft, setDraft] = useState<Criteria>(fromUrl);
  const [applied, setApplied] = useState<Criteria>(fromUrl);
  const [run, setRun] = useState(0);

  useEffect(() => {
    setDraft(fromUrl);
    setApplied(fromUrl);
    setRun((r) => r + 1);
  }, [fromUrl]);

  const title = status || "Browse All Students";
  const navHref = status ? `${BASE}/browse?${new URLSearchParams({ "f.status": status }).toString()}` : `${BASE}/browse`;
  const advancedKeys = ADVANCED.filter((k) => applied[k]);

  return (
    <StuFrame
      title={title}
      crumbs={[title]}
      nav={navHref}
      actions={
        <Btn small onClick={() => router.push(`${BASE}/search`)}>
          Advanced Search
        </Btn>
      }
    >
      <ErrorLine>{error}</ErrorLine>
      {meta ? (
        <Card title="Search Students">
          <Filters
            submit="Search Students"
            onSubmit={() => {
              setApplied({ ...draft });
              setRun((r) => r + 1);
            }}
          >
            <BasicFilters meta={meta} value={draft} set={(k, v) => setDraft((d) => ({ ...d, [k]: v }))} />
          </Filters>
          {advancedKeys.length || applied.q ? (
            <p className="pm-note mh-sa__muted">
              Includes Advanced Search criteria{applied.q ? ` and "${applied.q}"` : ""}.{" "}
              <button
                type="button"
                className="st-link"
                onClick={() => {
                  const next = { ...applied };
                  for (const k of [...ADVANCED, "q"]) delete next[k];
                  setApplied(next);
                  setDraft(next);
                  setRun((r) => r + 1);
                }}
              >
                Clear
              </button>
            </p>
          ) : null}
        </Card>
      ) : !error ? (
        <Empty>Loading…</Empty>
      ) : null}
      {meta ? <Results criteria={applied} run={run} /> : null}
    </StuFrame>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function AdvancedSearch() {
  const router = useRouter();
  const { meta, error } = useStudentsMeta();
  const [c, setC] = useState<Criteria>({});
  const v = (k: string) => c[k] ?? "";
  const set = (k: string) => (x: string) => setC((s) => ({ ...s, [k]: x }));
  const submit = () => router.push(`${BASE}/browse${qs(c)}`);
  return (
    <StuFrame title="Advanced Search" crumbs={["Advanced Search"]} nav={`${BASE}/browse`}>
      <ErrorLine>{error}</ErrorLine>
      {meta ? (
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="mh-sa__grid lx-grid">
              <F label="Status">
                <Sel value={v("status")} onChange={set("status")} empty="All Statuses" options={meta.statuses} />
              </F>
              <F label="SIS E-mail Address">
                <Txt value={v("sisEmail")} onChange={set("sisEmail")} />
              </F>
              <F label="Last Name">
                <Txt value={v("lastName")} onChange={set("lastName")} />
              </F>
              <F label="First Name">
                <Txt value={v("firstName")} onChange={set("firstName")} />
              </F>
              <F label="Middle Name">
                <Txt value={v("middleName")} onChange={set("middleName")} />
              </F>
              <F label="Preferred Name">
                <Txt value={v("preferredName")} onChange={set("preferredName")} />
              </F>
              <div className="mh-sa__field">
                <span className="mh-sa__label">Date of Birth</span>
                <div className="st-dob">
                  <Sel label="Month" value={v("dobMonth")} onChange={set("dobMonth")} empty="Month" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
                  <Sel label="Day" value={v("dobDay")} onChange={set("dobDay")} empty="Day" options={Array.from({ length: 31 }, (_, i) => String(i + 1))} />
                  <Txt label="Year" value={v("dobYear")} onChange={set("dobYear")} placeholder="Year" />
                </div>
              </div>
              <F label="Domestic / International">
                <Sel value={v("residency")} onChange={set("residency")} empty="All" options={meta.options.residency ?? []} />
              </F>
              <F label="Street Address">
                <Txt value={v("street")} onChange={set("street")} />
              </F>
              <F label="City">
                <Txt value={v("city")} onChange={set("city")} />
              </F>
              <F label="Postal/ZIP Code">
                <Txt value={v("postal")} onChange={set("postal")} />
              </F>
              <F label="Phone Number">
                <Txt value={v("phone")} onChange={set("phone")} />
              </F>
              <F label="E-mail Address">
                <Txt value={v("email")} onChange={set("email")} />
              </F>
              <F label="Discount Code">
                <Txt value={v("discountCode")} onChange={set("discountCode")} />
              </F>
              <F label="Campus">
                <Sel value={v("campus")} onChange={set("campus")} empty="All Campuses" options={meta.campuses} />
              </F>
              <F label="Delivery Method">
                <Sel value={v("delivery")} onChange={set("delivery")} empty="All" options={meta.options.deliveryMethods ?? []} />
              </F>
              <F label="Program">
                <Sel value={v("program")} onChange={set("program")} empty="All Programs" options={meta.programs.map((p) => p.name)} />
              </F>
              <F label="Admission Term">
                <Sel value={v("admissionTerm")} onChange={set("admissionTerm")} empty="All Admission Terms" options={meta.admissionTerms} />
              </F>
            </div>
            <div className="st-filters__actions" style={{ marginTop: 14 }}>
              <Btn onClick={() => router.push(`${BASE}/browse`)}>SIMPLE SEARCH</Btn>
              <Btn type="submit" tone="primary">
                Search Students
              </Btn>
            </div>
          </form>
        </Card>
      ) : !error ? (
        <Empty>Loading…</Empty>
      ) : null}
    </StuFrame>
  );
}
