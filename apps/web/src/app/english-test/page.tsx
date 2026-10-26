"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { SelfpacedShell } from "@/components/selfpaced/SelfpacedShell";
import { api } from "@/lib/api";

type Values = Record<string, string | boolean>;
const initial: Values = {
  institutionName: "CampusOne",
  branchProfile: "",
  siteName: "",
  voucherCode: "",
  firstName: "",
  middleName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  highSchoolEnrolled: "",
  address1: "",
  address2: "",
  country: "Canada",
  province: "British Columbia",
  otherProvince: "",
  city: "",
  postalCode: "",
  email: "",
  homePhone: "",
  mobilePhone: "",
  studentId: "",
  confirmStudentId: "",
  supplementalStudentId: "",
  resultInstitutions: "CampusOne",
  optOutCollegePlanningEmail: false,
  privacyAccepted: false,
};

export default function EnglishTestPage() {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ reference: string; submittedAt: string } | null>(null);
  const set = (key: string, value: string | boolean) => setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (values.studentId !== values.confirmStudentId) return setError("Student ID and Confirm Student ID must match.");
    if (!values.privacyAccepted) return setError("Accept the privacy policy before saving.");
    setBusy(true);
    try {
      const out = await api<{ reference: string; submittedAt: string }>(
        "/public/english-test-registrations",
        {
          method: "POST",
          body: JSON.stringify({
            ...values,
            resultInstitutions: String(values.resultInstitutions).split(",").map((x) => x.trim()).filter(Boolean),
          }),
        },
        undefined,
        { skipAuthRedirect: true },
      );
      setReceipt(out);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the registration.");
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <SelfpacedShell>
        <section className="sp-success">
          <p className="sp-kicker">REGISTRATION RECEIVED</p>
          <h1>Thank you for registering</h1>
          <p className="sp-lede">The registrar will review your profile and contact you with test details and credentials. This registration does not create programme enrolment or admission approval.</p>
          <p><strong>Reference:</strong> {receipt.reference}</p>
          <Link href="/selfpaced" className="sp-btn sp-btn--primary">Back to home</Link>
        </section>
      </SelfpacedShell>
    );
  }

  const input = (key: string, title: string, required = false, type = "text") => (
    <label className="sp-test__field">
      <span>{title}{required ? <em aria-hidden> *</em> : null}</span>
      <input className="sp-test__control" type={type} value={String(values[key])} required={required} onChange={(e) => set(key, e.target.value)} />
    </label>
  );
  const select = (key: string, title: string, options: string[], required = false) => (
    <label className="sp-test__field">
      <span>{title}{required ? <em aria-hidden> *</em> : null}</span>
      <select className="sp-test__control" value={String(values[key])} required={required} onChange={(e) => set(key, e.target.value)}><option value="">Select…</option>{options.map((x) => <option key={x}>{x}</option>)}</select>
    </label>
  );

  return (
    <SelfpacedShell>
      <section className="sp-test">
        <header className="sp-test__intro">
          <div>
            <p className="sp-kicker">HCC ENGLISH TEST</p>
            <h1>Student information</h1>
            <p>Register your profile for registrar review. Test scheduling and credentials are sent after review.</p>
          </div>
          <aside><strong>Before you begin</strong><span>Fields marked * are required. Keep your Student ID handy.</span></aside>
        </header>
        <form onSubmit={submit} className="sp-test__form">
          {[
            ["Institution context", <>{input("institutionName", "Institution name", true)}{input("branchProfile", "Branching profile")}{input("siteName", "Site name")}{input("voucherCode", "Voucher code")}</>],
            ["Identity", <>{input("firstName", "First name", true)}{input("middleName", "Middle name")}{input("lastName", "Last name", true)}{input("dateOfBirth", "Date of birth", true, "date")}{select("gender", "Gender", ["Female", "Male", "Non-binary", "Prefer not to say", "Other"], true)}{select("highSchoolEnrolled", "Currently enrolled in high school?", ["Yes", "No"], true)}</>],
            ["Address and contact", <>{input("address1", "Address 1", true)}{input("address2", "Address 2")}{input("country", "Country", true)}{select("province", "Province / state", ["British Columbia", "Alberta", "Ontario", "Quebec", "Other"], true)}{values.province === "Other" ? input("otherProvince", "If other, specify", true) : null}{input("city", "City", true)}{input("postalCode", "ZIP / postal code", true)}{input("email", "Email", true, "email")}{input("homePhone", "Home phone", false, "tel")}{input("mobilePhone", "Mobile phone", true, "tel")}</>],
            ["Student references", <>{input("studentId", "Student ID", true)}{input("confirmStudentId", "Confirm Student ID", true)}{input("supplementalStudentId", "Supplemental Student ID")}</>],
            ["Preferences", <>{input("resultInstitutions", "Institutions allowed to receive results (comma separated)")}<label className="sp-test__check sp-test__check--wide"><input type="checkbox" checked={Boolean(values.optOutCollegePlanningEmail)} onChange={(e) => set("optOutCollegePlanningEmail", e.target.checked)} /><span>Opt out of college-planning email</span></label></>],
          ].map(([title, content], index) => <fieldset key={String(title)} className="sp-test__section"><legend><span>{String(index + 1).padStart(2, "0")}</span>{title}</legend><div className="sp-test__grid">{content}</div></fieldset>)}
          <div className="sp-test__confirm">
            <label className="sp-test__check"><input type="checkbox" checked={Boolean(values.privacyAccepted)} onChange={(e) => set("privacyAccepted", e.target.checked)} /><span>I have read the <a href="/privacy" target="_blank">privacy policy</a> and confirm the information is accurate. *</span></label>
            <p><a href="/english-test/instructions" target="_blank">Student Instructions</a><span aria-hidden>·</span><a href="https://hccbconline.com/pdf/privacy-policy.pdf" target="_blank" rel="noreferrer">Official HCC privacy policy (PDF)</a></p>
          </div>
          {error ? <p className="sp-error" role="alert">{error}</p> : null}
          <div className="sp-test__actions"><Link href="/selfpaced" className="sp-btn sp-btn--ghost">Back</Link><button className="sp-btn sp-btn--primary" disabled={busy}>{busy ? "Saving…" : "Save registration"}</button></div>
        </form>
      </section>
    </SelfpacedShell>
  );
}
