"use client";

import "./apply.css";
import { FormEvent, useState } from "react";
import { api, clearSession, saveSession, type Session } from "@/lib/api";
import { SelfpacedShell } from "@/components/selfpaced/SelfpacedShell";

const PROGRAMS = [
  "Office Administration Diploma",
  "Pharmacy Assistant",
  "Red Seal Exam Preparation Electrician (Construction)",
  "Red Seal Exam Preparation Carpentry",
  "Red Seal Exam Preparation Plumber",
  "Red Seal Exam Preparation Chef",
  "Red Seal Exam HVAC Technician",
  "Red Seal Exam Preparation Machinist",
];
const DOCUMENTS = [
  "Grade 10 Certificate / Transcript",
  "Grade 12 Certificate / Transcript",
  "Post-Secondary Education Document",
  "Language Proficiency Test Report",
] as const;
const ACCEPTED_DOCUMENTS = ".pdf,.doc,.docx,.png,.jpg,.jpeg";
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const initial = {
  givenName: "",
  middleName: "",
  familyName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  residency: "",
  country: "Canada",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "British Columbia",
  postalCode: "",
  programCategory: "",
  programName: "",
  intakeTerm: "",
  campus: "Online",
  password: "",
  confirm: "",
  consent: false,
};

type ApplicationFormResponse = {
  documents: Array<{ id: string; label: string; status: string; fileName: string | null }>;
};

function mimeForFile(file: File) {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (
    {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
    } as Record<string, string>
  )[extension] ?? "";
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function deviceFingerprint() {
  const agent = typeof navigator === "undefined" ? "browser" : navigator.userAgent.replace(/\s+/g, " ").slice(0, 48);
  return `apply-${agent}-remember`.slice(0, 120);
}

export default function ApplyPage() {
  const [values, setValues] = useState(initial);
  const [documents, setDocuments] = useState<Record<string, File | null>>(() =>
    Object.fromEntries(DOCUMENTS.map((label) => [label, null])),
  );
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const [createdSession, setCreatedSession] = useState<Session | null>(null);
  const set = (key: keyof typeof initial, value: string | boolean) =>
    setValues((current) => ({ ...current, [key]: value }));

  function selectDocument(label: (typeof DOCUMENTS)[number], file?: File) {
    setError(null);
    if (!file) {
      setDocuments((current) => ({ ...current, [label]: null }));
      return;
    }
    if (!mimeForFile(file)) {
      setError(`${label}: choose a PDF, DOC, DOCX, PNG, JPG or JPEG file.`);
      return;
    }
    if (file.size === 0) {
      setError(`${label}: the selected file is empty.`);
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError(`${label}: files must be 10 MB or smaller.`);
      return;
    }
    setDocuments((current) => ({ ...current, [label]: file }));
  }

  async function signInApplicant(): Promise<Session> {
    const session = await api<Session & { requiresMfa?: boolean }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: values.email.trim().toLowerCase(),
          password: values.password,
          deviceFingerprint: deviceFingerprint(),
          remember: true,
        }),
      },
      undefined,
      { skipAuthRedirect: true },
    );
    if (!session.accessToken || !session.roles?.includes("applicant")) {
      throw new Error("Application was created, but the secure applicant session could not be started. Sign in and retry.");
    }
    clearSession();
    saveSession(session, true);
    setCreatedSession(session);
    return session;
  }

  async function uploadDocuments(session: Session) {
    const form = await api<ApplicationFormResponse>("/applicant/application/form", {}, session.accessToken);
    const byLabel = new Map(form.documents.map((document) => [document.label, document]));
    for (let index = 0; index < DOCUMENTS.length; index += 1) {
      const label = DOCUMENTS[index];
      const file = documents[label];
      const record = byLabel.get(label);
      if (!file || !record) throw new Error(`Could not prepare ${label} for upload.`);
      if (record.status !== "missing" && record.fileName === file.name) continue;
      setProgress(`Uploading document ${index + 1} of ${DOCUMENTS.length}: ${label}`);
      const contentBase64 = toBase64(new Uint8Array(await file.arrayBuffer()));
      await api(
        "/applicant/action",
        {
          method: "POST",
          body: JSON.stringify({
            action: "upload_document",
            path: "/applicant/documents",
            payload: {
              documentId: record.id,
              filename: file.name,
              mimeType: mimeForFile(file),
              sizeBytes: file.size,
              contentBase64,
            },
          }),
        },
        session.accessToken,
      );
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const required: Array<keyof typeof initial> = [
      "givenName", "familyName", "email", "phone", "dateOfBirth", "gender", "residency", "country",
      "addressLine1", "city", "programCategory", "programName", "intakeTerm", "campus",
    ];
    if (required.some((key) => !String(values[key]).trim())) {
      setError("Complete every required identity, address and program field.");
      return;
    }
    if (DOCUMENTS.some((label) => !documents[label])) {
      setError("Select every required document before creating your application.");
      return;
    }
    if (values.password.length < 8) return setError("Password must be at least 8 characters.");
    if (values.password !== values.confirm) return setError("Passwords do not match.");
    if (!values.consent) return setError("Confirm the declaration before creating your application.");

    setBusy(true);
    try {
      if (!accountCreated) {
        setProgress("Creating your secure application…");
        const { confirm: _confirm, consent: _consent, ...body } = values;
        await api(
          "/public/apply",
          { method: "POST", body: JSON.stringify({ ...body, applicationAcknowledgement: "Confirmed" }) },
          undefined,
          { skipAuthRedirect: true },
        );
        setAccountCreated(true);
      }
      setProgress("Securing your applicant session…");
      const session = createdSession ?? (await signInApplicant());
      await uploadDocuments(session);
      setProgress("Documents uploaded. Opening your application…");
      window.location.assign("/applicant/application?registered=1&documents=uploaded");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not create your application.";
      setError(accountCreated || createdSession ? `${message} Your application is saved; retry to continue the uploads.` : message);
      setProgress("");
      setBusy(false);
    }
  }

  const input = (key: keyof typeof initial, label: string, required = false, type = "text") => (
    <label className="apply-field"><span>{label}{required ? " *" : ""}</span><input type={type} value={String(values[key])} required={required} onChange={(event) => set(key, event.target.value)} /></label>
  );
  const select = (key: keyof typeof initial, label: string, options: string[], required = false) => (
    <label className="apply-field"><span>{label}{required ? " *" : ""}</span><select value={String(values[key])} required={required} onChange={(event) => set(key, event.target.value)}><option value="">Select…</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
  );

  return (
    <SelfpacedShell nextAfterLogin="/applicant/application">
      <main className="apply-page">
        <header className="apply-hero"><p className="sp-kicker">CAMPUSONE ADMISSIONS</p><h1>Apply with confidence.</h1><p>Complete your details and upload every required document here. We create one secure applicant account and save the documents directly to your application.</p><div className="apply-steps">{["Personal", "Program", "Documents", "Review"].map((item, index) => <span key={item}><b>{index + 1}</b>{item}</span>)}</div></header>
        <form className="apply-form" onSubmit={submit}>
          <fieldset><legend><b>01</b> Identity and address</legend><div className="apply-grid">{input("givenName", "First name", true)}{input("middleName", "Middle name")}{input("familyName", "Last name", true)}{input("email", "Email", true, "email")}{input("phone", "Phone", true, "tel")}{input("dateOfBirth", "Date of birth", true, "date")}{select("gender", "Gender", ["Female", "Male", "Non-binary", "Prefer not to say", "Other"], true)}{select("residency", "Visa / residency status", ["Canadian citizen", "Permanent resident", "Study permit", "Work permit", "Visitor", "Other"], true)}{input("country", "Country", true)}{input("addressLine1", "Address line 1", true)}{input("addressLine2", "Address line 2")}{input("city", "City", true)}{input("region", "Province / state")}{input("postalCode", "Postal code")}</div></fieldset>
          <fieldset><legend><b>02</b> Program selection</legend><div className="apply-grid">{select("programCategory", "Program category", ["Business", "Health", "Trades", "Technology", "Other"], true)}{select("programName", "Program", PROGRAMS, true)}{select("intakeTerm", "Admission term", ["Winter 2027", "Spring 2027", "Fall 2027", "Continuous / self-paced"], true)}{select("campus", "Campus", ["Surrey", "Victoria", "Online"], true)}</div></fieldset>
          <fieldset><legend><b>03</b> Required documents</legend><p className="apply-note">Upload PDF, DOC, DOCX, PNG or JPG files up to 10 MB each. All {DOCUMENTS.length} documents are required. Do not upload a passport, SIN card or other government ID.</p><div className="apply-document-grid">{DOCUMENTS.map((label) => { const file = documents[label]; return <label className={`apply-document${file ? " apply-document--selected" : ""}`} key={label}><span className="apply-document__title">{label} *</span><span className="apply-document__status">{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "Choose document"}</span><input type="file" accept={ACCEPTED_DOCUMENTS} required={!file} disabled={busy} onChange={(event) => selectDocument(label, event.target.files?.[0])} /></label>; })}</div></fieldset>
          <fieldset><legend><b>04</b> Account and declaration</legend><div className="apply-grid">{input("password", "Create password", true, "password")}{input("confirm", "Confirm password", true, "password")}</div><label className="apply-consent"><input type="checkbox" checked={values.consent} onChange={(event) => set("consent", event.target.checked)} /><span>I confirm the information is complete and correct, and I agree to the <a href="/privacy" target="_blank">privacy notice</a>. *</span></label></fieldset>
          {error ? <p className="sp-error" role="alert">{error}</p> : null}{progress ? <p className="apply-progress" role="status">{progress}</p> : null}
          <div className="apply-actions"><a className="sp-btn sp-btn--ghost" href="/selfpaced">Back</a><button className="sp-btn sp-btn--primary" disabled={busy}>{busy ? "Saving application…" : accountCreated ? "Retry document upload" : "Create application & upload documents"}</button></div>
        </form>
      </main>
    </SelfpacedShell>
  );
}
