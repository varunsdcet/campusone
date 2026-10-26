"use client";

import { useMemo, useState } from "react";
import { formForActivity, type LmsFormField } from "@/lib/lmsActivityForms";
import { formatFileSize, uploadLmsFile } from "@/lib/lmsFiles";
import { LMS_ACCESS_RESTRICTIONS_KEY, LmsAccessRestrictionsEditor } from "./LmsAccessRestrictions";

type RosterStudent = {
  studentId?: string;
  name: string;
  studentNumber: string;
  email: string;
};

type Props = {
  code: string;
  label: string;
  busy?: boolean;
  roster?: RosterStudent[];
  groups?: Array<{ id: string; name: string; members: Array<{ id: string; name: string }> }>;
  sectionId?: string;
  /** Saved form values when editing an existing activity. */
  initial?: Record<string, string>;
  heading?: string;
  onSave: (values: Record<string, string>) => boolean | void | Promise<boolean | void>;
  onCancel: () => void;
};

/** `datetime-local` has no zone, so values travel as ISO instants and are shown in the browser's zone. */
function toLocalInput(value: string) {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(value: string) {
  const d = new Date(value);
  return !value || Number.isNaN(d.getTime()) ? value : d.toISOString();
}

export function LmsAddForm({ code, label, busy, roster = [], groups = [], sectionId, initial, heading, onSave, onCancel }: Props) {
  const spec = useMemo(() => formForActivity(code), [code]);
  const isOnlineClass = /bigbluebutton/i.test(code);
  const editing = Boolean(initial);
  const dateFields = useMemo(
    () => spec.sections.flatMap((s) => s.fields.filter((f) => f.type === "datetime").map((f) => f.name)),
    [spec],
  );
  const initialFormValues = useMemo(() => {
    const next: Record<string, string> = {
      Name: isOnlineClass ? "Online Class Link" : `New ${label}`,
      Audience: "All enrolled students",
      "Publish meeting": "Yes — notify students now",
    };
    for (const section of spec.sections) {
      for (const field of section.fields) {
        if (field.default) next[field.name] = field.default;
        if (field.type === "checkbox") next[field.name] = field.checked ? "yes" : "";
      }
    }
    if (initial) {
      for (const [key, value] of Object.entries(initial)) next[key] = value;
      for (const section of spec.sections) {
        for (const field of section.fields) {
          if (field.type === "datetime" && next[field.name]) next[field.name] = toLocalInput(next[field.name]);
        }
      }
    }
    return next;
  }, [initial, isOnlineClass, label, spec]);
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    spec.sections.forEach((s, i) => {
      next[s.title] = i < 3;
    });
    return next;
  });
  const [values, setValues] = useState<Record<string, string>>(() => initialFormValues);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [restrictionsValid, setRestrictionsValid] = useState(true);
  const needsFile = !editing && /^file$/i.test(code) && spec.sections.some((s) => s.fields.some((f) => f.type === "file"));

  async function pickFile(fieldName: string, file: File | undefined) {
    if (!file) return;
    if (!sectionId) {
      setError("Open this from a course section to upload files.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const up = await uploadLmsFile(sectionId, file);
      setValues((prev) => ({
        ...prev,
        [fieldName]: `${up.name}${up.size ? ` · ${formatFileSize(up.size)}` : ""}`,
        FileId: up.id,
        Name: !prev.Name || prev.Name === `New ${label}` ? up.name.replace(/\.[^.]+$/, "") : prev.Name,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (spec.error) {
    return (
      <section className="mh-teacher-card mh-lms-error">
        <h2>Error: {spec.error}</h2>
        <p className="mh-teacher-muted">More information about this error</p>
        <button type="button" className="mh-teacher-btn" onClick={onCancel}>
          Continue
        </button>
      </section>
    );
  }

  function set(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  const selectable = roster.filter((s) => Boolean(s.studentId));
  const audienceSelected = /selected/i.test(values.Audience || "");

  return (
    <section className="mh-teacher-card mh-lms-addform">
      <div className="mh-lms-toolbar">
        <h2>{heading || spec.heading}</h2>
        <button
          type="button"
          className="mh-teacher-link"
          onClick={() => {
            const next: Record<string, boolean> = {};
            for (const s of spec.sections) next[s.title] = true;
            setOpen(next);
          }}
        >
          Expand all
        </button>
      </div>
      {spec.sections.map((section) => (
        <details
          key={section.title}
          className="mh-lms-addform__sec"
          open={open[section.title] !== false}
          onToggle={(e) => setOpen((p) => ({ ...p, [section.title]: (e.target as HTMLDetailsElement).open }))}
        >
          <summary>{section.title}</summary>
          <div className="mh-lms-addform__fields">
            {section.title === "Restrict access" ? (
              <LmsAccessRestrictionsEditor
                value={values[LMS_ACCESS_RESTRICTIONS_KEY] || ""}
                roster={roster}
                groups={groups}
                onChange={(value) => set(LMS_ACCESS_RESTRICTIONS_KEY, value)}
                onValidityChange={setRestrictionsValid}
              />
            ) : null}
            {section.fields.map((field) => (
              <Field
                key={`${field.name}-${formVersion}`}
                field={field}
                value={values[field.name] || ""}
                onChange={set}
                onFile={(name, file) => void pickFile(name, file)}
                uploading={uploading}
              />
            ))}
            {isOnlineClass && section.title === "Publish to students" && audienceSelected ? (
              <div className="mh-lms-online-roster">
                <p className="mh-teacher-muted">Select students to notify ({selectedIds.length} selected)</p>
                {selectable.length === 0 ? (
                  <p className="mh-teacher-muted">No enrolled students on this section roster.</p>
                ) : (
                  <ul className="mh-lms-online-roster__list">
                    {selectable.map((s) => {
                      const id = s.studentId!;
                      const checked = selectedIds.includes(id);
                      return (
                        <li key={id}>
                          <label className="mh-lms-check">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSelectedIds((prev) =>
                                  e.target.checked ? [...prev, id] : prev.filter((x) => x !== id),
                                )
                              }
                            />
                            <span>
                              {s.name}
                              <span className="mh-teacher-muted">
                                {" "}
                                · {s.studentNumber || s.email}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </details>
      ))}
      {error ? <p className="mh-lms-qform__error">{error}</p> : null}
      <p className="mh-lms-legend">
        <span className="mh-lms-required">!</span> Required
      </p>
      <div className="mh-lms-toolbar">
        <button
          type="button"
          className="mh-teacher-btn"
          disabled={busy || saving || uploading || !restrictionsValid}
          onClick={async () => {
            if (!String(values.Name || "").trim()) {
              setError("Name is required.");
              return;
            }
            const missing = spec.sections
              .flatMap((s) => s.fields)
              .find((f) => f.required && (f.type === "text" || f.type === "textarea") && !String(values[f.name] || "").trim());
            if (missing) {
              setError(`${missing.label} is required.`);
              return;
            }
            if (values["External URL"] !== undefined && /^url$/i.test(code) && !/^https?:\/\/\S+$/i.test(values["External URL"].trim())) {
              setError("External URL must be a full address starting with https:// or http://");
              return;
            }
            if (needsFile && !values.FileId) {
              setError("Upload a file first.");
              return;
            }
            if (isOnlineClass && audienceSelected && selectedIds.length === 0) {
              setError("Select at least one student, or choose All enrolled students.");
              return;
            }
            setError("");
            const publishMeeting = /yes/i.test(values["Publish meeting"] || "Yes") ? "yes" : "no";
            const out = { ...values };
            for (const name of dateFields) if (out[name]) out[name] = toIso(out[name]);
            setSaving(true);
            try {
              const saved = await onSave({
                ...out,
                PublishMeeting: publishMeeting,
                NotifyStudentIds: audienceSelected ? selectedIds.join(",") : "",
              });
              if (saved === true && !editing) {
                setValues({ ...initialFormValues });
                setSelectedIds([]);
                setFormVersion((version) => version + 1);
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : "Save failed");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : isOnlineClass && !editing ? "Publish online class" : "Save and return to course"}
        </button>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

function Field({
  field,
  value,
  onChange,
  onFile,
  uploading,
}: {
  field: LmsFormField;
  value: string;
  onChange: (name: string, value: string) => void;
  onFile: (name: string, file: File | undefined) => void;
  uploading?: boolean;
}) {
  if (field.type === "checkbox") {
    return (
      <label className="mh-lms-check">
        <input type="checkbox" checked={value === "yes"} onChange={(e) => onChange(field.name, e.target.checked ? "yes" : "")} />
        {field.label}
      </label>
    );
  }
  if (field.type === "static") {
    return (
      <div className="mh-lms-addform__static">
        <span>{field.label}</span>
        <strong>{field.default}</strong>
      </div>
    );
  }
  if (field.type === "matrix" && field.rows && field.columns) {
    return (
      <div className="mh-lms-review">
        <table>
          <thead>
            <tr>
              <th />
              {field.columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {field.rows.map((row) => (
              <tr key={row}>
                <th scope="row">{row}</th>
                {field.columns!.map((col) => (
                  <td key={col}>
                    <input type="checkbox" defaultChecked={col !== "During the attempt" || row === "The attempt"} aria-label={`${row} ${col}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (field.type === "file") {
    return (
      <label>
        <span>
          {field.label} {field.required ? <em className="mh-lms-required">!</em> : null}
        </span>
        <div className="mh-teacher-dropzone">
          <input type="file" disabled={uploading} onChange={(e) => onFile(field.name, e.target.files?.[0])} />
          <p className="mh-teacher-muted">{field.help || "PDF, Office documents, text or images up to 8 MB."}</p>
          {uploading ? <p>Uploading…</p> : value ? <p>Uploaded: {value}</p> : null}
        </div>
      </label>
    );
  }
  if (field.type === "datetime") {
    return (
      <label>
        <span>{field.label}</span>
        <div className="mh-lms-dt">
          <input type="datetime-local" className="mh-teacher-field" value={value} onChange={(e) => onChange(field.name, e.target.value)} />
          <label className="mh-lms-check">
            <input type="checkbox" defaultChecked={Boolean(value)} />
            Enable
          </label>
        </div>
      </label>
    );
  }
  if (field.type === "select") {
    return (
      <label>
        <span>{field.label}</span>
        <select className="mh-teacher-field" value={value} onChange={(e) => onChange(field.name, e.target.value)}>
          {(field.options || []).map((opt) => (
            <option key={opt}>{opt}</option>
          ))}
        </select>
      </label>
    );
  }
  if (field.type === "textarea") {
    return (
      <label className="mh-lms-addform__wide">
        <span>
          {field.label} {field.required ? <em className="mh-lms-required">!</em> : null}
        </span>
        <textarea className="mh-teacher-field mh-teacher-field--tall" rows={5} value={value} onChange={(e) => onChange(field.name, e.target.value)} />
      </label>
    );
  }
  return (
    <label>
      <span>
        {field.label} {field.required ? <em className="mh-lms-required">!</em> : null}
      </span>
      <input className="mh-teacher-field" type={field.type === "number" ? "text" : "text"} inputMode={field.type === "number" ? "decimal" : undefined} value={value} onChange={(e) => onChange(field.name, e.target.value)} />
      {field.help ? <small className="mh-teacher-muted">{field.help}</small> : null}
    </label>
  );
}

export function LmsModuleError({ title, onContinue }: { title: string; onContinue: () => void }) {
  return (
    <section className="mh-teacher-card mh-lms-error">
      <h2>{title}</h2>
      <p className="mh-teacher-muted">No Activity / unavailable-module context</p>
      <p className="mh-teacher-muted">More information about this error</p>
      <button type="button" className="mh-teacher-btn" onClick={onContinue}>
        Continue
      </button>
    </section>
  );
}
