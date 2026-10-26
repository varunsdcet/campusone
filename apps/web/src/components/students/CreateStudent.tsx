"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SaNotice } from "@/components/superadmin/shared";
import {
  BASE,
  Btn,
  Card,
  Check,
  Empty,
  ErrorLine,
  F,
  FileDrop,
  Grid,
  Sel,
  StuFrame,
  Txt,
  profileHref,
  send,
  useStudentsMeta,
  useSubmit,
  type PendingFile,
  type StudentsMeta,
} from "./kit";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Form = Record<string, string>;
type Created = { id: string; studentNumber: string; login: { email: string; temporaryPassword?: string } | null };

const REQUIRED: Array<[string, string]> = [
  ["lastName", "Last Name"],
  ["firstName", "First Name"],
  ["dobMonth", "Date of Birth (Month)"],
  ["dobDay", "Date of Birth (Day)"],
  ["dobYear", "Date of Birth (Year)"],
  ["residency", "Domestic / International"],
  ["street", "Street Address"],
  ["city", "City"],
  ["postal", "Postal / ZIP Code"],
  ["country", "Country"],
  ["province", "Province / State"],
  ["phone", "Phone Number"],
  ["email", "E-mail Address"],
  ["emergencyName", "Emergency Contact Name"],
  ["emergencyPhone", "Emergency Contact Phone Number"],
  ["visaStatus", "Visa Status"],
  ["campus", "Campus"],
  ["delivery", "Delivery Method"],
  ["program", "Program of Study"],
  ["rateCategory", "Rate Category / Fee Status"],
  ["status", "Student Status"],
];

export function statusOptions(meta: StudentsMeta) {
  return meta.statusTree.flatMap((n) => [{ value: n.name, label: n.name }, ...n.children.map((c) => ({ value: c, label: `\u00a0\u00a0\u00a0— ${c}` }))]);
}

export function CreateStudent() {
  const router = useRouter();
  const { meta, error } = useStudentsMeta();
  const [f, setF] = useState<Form>({});
  const [acks, setAcks] = useState([false, false]);
  const [assignAdvisors, setAssignAdvisors] = useState(false);
  const [advisors, setAdvisors] = useState<string[]>([]);
  const [assignAgent, setAssignAgent] = useState(false);
  const [transcripts, setTranscripts] = useState<PendingFile[]>([]);
  const [createLogin, setCreateLogin] = useState(true);
  const [created, setCreated] = useState<Created | null>(null);
  const { busy, error: saveError, setError, run } = useSubmit();

  const v = (k: string) => f[k] ?? "";
  const set = (k: string) => (x: string) => setF((s) => ({ ...s, [k]: x, ...(k === "country" ? { province: "" } : {}) }));

  if (!meta)
    return (
      <StuFrame title="Create Student Profile" crumbs={["Create Student Profile"]} nav={`${BASE}/create`}>
        <ErrorLine>{error}</ErrorLine>
        {!error ? <Empty>Loading…</Empty> : null}
      </StuFrame>
    );

  const country = meta.countries.find((c) => c.name === v("country"));
  const opts = meta.options;

  const submit = async () => {
    const missing = REQUIRED.filter(([k]) => !v(k).trim()).map(([, label]) => label);
    if (assignAgent && !v("agentId")) missing.push("Agent");
    if (assignAdvisors && !advisors.length) missing.push("Advisor(s)");
    if (missing.length) {
      setError(`Please complete: ${missing.join(", ")}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (createLogin && v("password") && v("password").length < 8) {
      setError("Password must be at least 8 characters, or leave it blank to generate a temporary password");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const out = await run(
      () =>
        send<Created>("/", "POST", {
          ...f,
          createLogin,
          password: createLogin ? v("password") : "",
          acknowledgements: acks,
          assignAdvisors,
          advisors,
          assignAgent,
          transcripts: transcripts.map((t) => ({ name: t.name, mime: t.mime, base64: t.base64 })),
        }),
      "Could not save student details",
    );
    const notice = (o: Created) => `${profileHref(o.id)}?notice=${encodeURIComponent(`Student profile created (${o.studentNumber}).${o.login ? ` Login: ${o.login.email}.` : ""}`)}`;
    if (out?.login?.temporaryPassword) setCreated(out);
    else if (out) router.push(notice(out));
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (created?.login?.temporaryPassword)
    return (
      <StuFrame title="Create Student Profile" crumbs={["Create Student Profile"]} nav={`${BASE}/create`}>
        <SaNotice tone="success">Student profile and login created.</SaNotice>
        <Card title="STUDENT LOGIN">
          <p>
            {created.studentNumber} can now sign in with <strong>{created.login.email}</strong> and this temporary password:
          </p>
          <p>
            <code style={{ fontSize: 16, userSelect: "all" }}>{created.login.temporaryPassword}</code>
          </p>
          <p className="mh-sa__muted">It is shown only once. Give it to the student, who can replace it with Change Password or Forgot Password.</p>
          <div className="mh-sa__actions">
            <Btn tone="primary" onClick={() => router.push(`${profileHref(created.id)}?notice=${encodeURIComponent(`Student profile created (${created.studentNumber}).`)}`)}>
              Open Student Profile
            </Btn>
          </div>
        </Card>
      </StuFrame>
    );

  return (
    <StuFrame title="Create Student Profile" crumbs={["Create Student Profile"]} nav={`${BASE}/create`}>
      {saveError ? <SaNotice tone="error">{saveError}</SaNotice> : null}
      <form
        className="mh-sa__stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Card title="CONTACT INFORMATION">
          <Grid>
            <F label="Last Name" req>
              <Txt value={v("lastName")} onChange={set("lastName")} />
            </F>
            <F label="First Name" req>
              <Txt value={v("firstName")} onChange={set("firstName")} />
            </F>
            <F label="Middle Name">
              <Txt value={v("middleName")} onChange={set("middleName")} />
            </F>
            <F label="Preferred Name">
              <Txt value={v("preferredName")} onChange={set("preferredName")} />
            </F>
            <div className="mh-sa__field">
              <span className="mh-sa__label">
                Date of Birth<span className="lx-req">*</span>
              </span>
              <div className="st-dob">
                <Sel label="Month" value={v("dobMonth")} onChange={set("dobMonth")} empty="Month" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
                <Sel label="Day" value={v("dobDay")} onChange={set("dobDay")} empty="Day" options={Array.from({ length: 31 }, (_, i) => String(i + 1))} />
                <Txt label="Year" value={v("dobYear")} onChange={set("dobYear")} placeholder="Year" />
              </div>
            </div>
            <F label="Gender">
              <Sel value={v("gender")} onChange={set("gender")} empty="— Select —" options={opts.genders ?? []} />
            </F>
            <F label="Domestic / International" req>
              <Sel value={v("residency")} onChange={set("residency")} empty="— Select —" options={opts.residency ?? []} />
            </F>
            <F label="Street Address" req>
              <Txt value={v("street")} onChange={set("street")} />
            </F>
            <F label="City" req>
              <Txt value={v("city")} onChange={set("city")} />
            </F>
            <F label="Postal / ZIP Code" req>
              <Txt value={v("postal")} onChange={set("postal")} />
            </F>
            <F label="Country" req>
              {meta.countries.length ? <Sel value={v("country")} onChange={set("country")} empty="— Select —" options={meta.countries.map((c) => c.name)} /> : <Txt value={v("country")} onChange={set("country")} />}
            </F>
            <F label="Province / State" req>
              {country?.regions.length ? (
                <Sel value={v("province")} onChange={set("province")} empty="— Select —" options={country.regions} />
              ) : (
                <Txt value={v("province")} onChange={set("province")} placeholder={meta.countries.length && !country ? "Select a country first" : ""} />
              )}
            </F>
            <F label="Phone Number" req>
              <Txt type="tel" value={v("phone")} onChange={set("phone")} />
            </F>
            <F label="E-mail Address" req>
              <Txt type="email" value={v("email")} onChange={set("email")} />
            </F>
          </Grid>
        </Card>

        <Card title="STUDENT LOGIN">
          <div className="lx-checks">
            <Check checked={createLogin} onChange={setCreateLogin}>
              Create a login account for this student (signs in with the e-mail address above)
            </Check>
          </div>
          {createLogin ? (
            <Grid>
              <F label="Password" hint="Optional. Leave blank to generate a temporary password that is shown once after saving.">
                <Txt type="password" value={v("password")} onChange={set("password")} />
              </F>
            </Grid>
          ) : (
            <p className="mh-sa__muted">Without a login the student cannot sign in or reset a password until one is added in User Management.</p>
          )}
        </Card>

        <Card title="EMERGENCY CONTACT">
          <Grid>
            <F label="Emergency Contact Name" req>
              <Txt value={v("emergencyName")} onChange={set("emergencyName")} />
            </F>
            <F label="Emergency Contact Phone Number" req>
              <Txt type="tel" value={v("emergencyPhone")} onChange={set("emergencyPhone")} />
            </F>
          </Grid>
        </Card>

        <Card title="ENROLMENT INFORMATION">
          <Grid>
            <F label="Discount Code">
              <Txt value={v("discountCode")} onChange={set("discountCode")} />
            </F>
            <F label="Visa Status" req>
              <Sel value={v("visaStatus")} onChange={set("visaStatus")} empty="— Select —" options={opts.visaStatuses ?? []} />
            </F>
            <F label="Visa Expiry Date">
              <Txt type="date" value={v("visaExpiry")} onChange={set("visaExpiry")} />
            </F>
            <F label="Campus" req>
              <Sel value={v("campus")} onChange={set("campus")} empty="— Select —" options={meta.campuses} />
            </F>
            <F label="Delivery Method" req>
              <Sel value={v("delivery")} onChange={set("delivery")} empty="— Select —" options={opts.deliveryMethods ?? []} />
            </F>
            <F label="Program of Study" req>
              <Sel value={v("program")} onChange={set("program")} empty="— Select —" options={meta.programs.map((p) => p.name)} />
            </F>
            <F label="Admission Term">
              <Sel value={v("admissionTerm")} onChange={set("admissionTerm")} empty="— Select —" options={meta.admissionTerms} />
            </F>
            <F label="Academic History" wide hint="Previous schools, programs and credentials earned.">
              <textarea className="mh-sa__input" rows={3} value={v("academicHistory")} onChange={(e) => set("academicHistory")(e.target.value)} />
            </F>
            <div className="mh-sa__field mh-sa__field--wide">
              <span className="mh-sa__label">Transcripts</span>
              <FileDrop files={transcripts} onChange={setTranscripts} label="Choose File" />
            </div>
          </Grid>
        </Card>

        <Card title="DECLARATION">
          <Grid>
            <F label="This form was completed by">
              <Sel value={v("declarationBy")} onChange={set("declarationBy")} empty="— Select —" options={opts.declarationBy ?? []} />
            </F>
          </Grid>
          <div className="lx-checks" style={{ marginTop: 10 }}>
            {(opts.declarationAcks ?? []).map((label, i) => (
              <Check key={label} checked={acks[i] ?? false} onChange={(on) => setAcks((a) => a.map((x, j) => (j === i ? on : x)))}>
                {label}
              </Check>
            ))}
          </div>
        </Card>

        <Card title="FEE STATUS, ADVISORS & AGENT">
          <div className="lx-checks">
            <Check checked={assignAdvisors} onChange={setAssignAdvisors}>
              Assign advisor(s)
            </Check>
          </div>
          {assignAdvisors ? (
            <F label="Advisor(s)" wide>
              <select className="mh-sa__input" multiple size={Math.min(6, Math.max(3, meta.advisors.length))} value={advisors} onChange={(e) => setAdvisors(Array.from(e.target.selectedOptions).map((o) => o.value))}>
                {meta.advisors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </F>
          ) : null}
          <div className="lx-checks" style={{ marginTop: 8 }}>
            <Check checked={assignAgent} onChange={setAssignAgent}>
              Assign agent
            </Check>
          </div>
          {assignAgent ? (
            <F label="Agent">
              {meta.agents.length ? <Sel value={v("agentId")} onChange={set("agentId")} empty="— Select —" options={meta.agents.map((a) => ({ value: a.id, label: a.name }))} /> : <span className="mh-sa__muted">No agents are configured in Financial Management.</span>}
            </F>
          ) : null}
          <Grid>
            <F label="Rate Category / Fee Status" req>
              <Sel value={v("rateCategory")} onChange={set("rateCategory")} empty="— Select —" options={opts.rateCategories ?? []} />
            </F>
            <F label="Student Status" req>
              <Sel value={v("status")} onChange={set("status")} empty="— Select —" options={statusOptions(meta)} />
            </F>
          </Grid>
        </Card>

        <div className="mh-sa__actions">
          <Link href={`${BASE}/browse`} className="mh-sa__btn">
            Cancel
          </Link>
          <Btn type="submit" tone="primary" disabled={busy}>
            {busy ? "Saving…" : "Save Student"}
          </Btn>
        </div>
      </form>
    </StuFrame>
  );
}
