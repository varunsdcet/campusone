"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { errorMessage, saApi } from "@/lib/superAdmin";
import { SaCard, SaField, SaNotice, SuperFrame } from "./shared";

export function SuperAccomplishments() {
  const [items, setItems] = useState<Array<{ id: string; title: string; description: string | null; earnedAt: string | null }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    saApi<{ items: NonNullable<typeof items> }>("/me/accomplishments")
      .then((r) => setItems(r.items))
      .catch((err) => setError(errorMessage(err, "Could not load accomplishments")));
  }, []);
  return (
    <SuperFrame breadcrumbs={["Home", "My Profile", "Accomplishments"]} activeHref="/admin/account/accomplishments" title="My Accomplishments & Badges">
      {error ? <SaNotice tone="error">{error}</SaNotice> : null}
      <SaCard>
        {!items ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : items.length ? (
          <ul className="mh-sa-badges">
            {items.map((b) => (
              <li key={b.id}>
                <span className="mh-sa-badges__icon" aria-hidden>
                  ★
                </span>
                <div>
                  <strong>{b.title}</strong>
                  {b.description ? <p>{b.description}</p> : null}
                  {b.earnedAt ? <small>Earned {new Date(b.earnedAt).toLocaleDateString()}</small> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mh-sa__empty">No accomplishments / badges were found.</p>
        )}
      </SaCard>
    </SuperFrame>
  );
}

export function SuperSecuritySettings() {
  return (
    <SuperFrame breadcrumbs={["Home", "My Profile", "Security Settings"]} activeHref="/admin/account/security" title="Security Settings">
      <div className="mh-sa-sec">
        <Link href="/admin/account/security/password" className="mh-sa-sec__option">
          <strong>Account Password</strong>
          <span>Account password is used to log in to the system.</span>
          <span>Password should be kept private and secure.</span>
        </Link>
        <Link href="/admin/account/security/questions" className="mh-sa-sec__option">
          <strong>Security Questions</strong>
          <span>Security questions are used to recover the account if password is forgotten.</span>
        </Link>
      </div>
    </SuperFrame>
  );
}

export function SuperChangePassword() {
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (form.newPassword !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await saApi("/me/password", { method: "PUT", body: JSON.stringify(form) });
      setForm({ newPassword: "", confirmPassword: "" });
      setNotice("Password updated. Other signed-in sessions were signed out.");
    } catch (err) {
      setError(errorMessage(err, "Could not change password"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SuperFrame breadcrumbs={["Home", "Security Settings", "Change Password"]} activeHref="/admin/account/security" title="Change Your Password">
      {error ? <SaNotice tone="error">{error}</SaNotice> : null}
      {notice ? <SaNotice tone="success">{notice}</SaNotice> : null}
      <SaCard title="CHANGE YOUR PASSWORD">
        <form className="mh-sa__form mh-sa__form--narrow" onSubmit={onSubmit}>
          <SaField label="New Password">
            <input
              className="mh-sa__input"
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              required
              minLength={8}
            />
          </SaField>
          <SaField label="Confirm Password">
            <input
              className="mh-sa__input"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              required
            />
          </SaField>
          <div className="mh-sa__actions">
            <Link href="/admin/account/security" className="mh-sa__btn">
              Cancel
            </Link>
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
              {busy ? "Saving…" : "Save Password"}
            </button>
          </div>
        </form>
      </SaCard>
    </SuperFrame>
  );
}

type QuestionState = { question: string; answer: string; answered: boolean };

export function SuperSecurityQuestions() {
  const [options, setOptions] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionState[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function apply(r: { options: string[]; questions: Array<{ question: string; answered: boolean }> }) {
    setOptions(r.options);
    setQuestions(r.questions.map((q, i) => ({ question: q.question || r.options[i] || "", answer: "", answered: q.answered })));
  }

  useEffect(() => {
    saApi<{ options: string[]; questions: Array<{ question: string; answered: boolean }> }>("/me/security-questions")
      .then(apply)
      .catch((err) => setError(errorMessage(err, "Could not load security questions")));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!questions) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      apply(
        await saApi("/me/security-questions", {
          method: "PUT",
          body: JSON.stringify({ questions: questions.map(({ question, answer }) => ({ question, answer })) }),
        }),
      );
      setNotice("Security questions saved.");
    } catch (err) {
      setError(errorMessage(err, "Could not save security questions"));
    } finally {
      setBusy(false);
    }
  }

  function update(i: number, patch: Partial<QuestionState>) {
    setQuestions((qs) => qs?.map((q, idx) => (idx === i ? { ...q, ...patch } : q)) ?? null);
  }

  return (
    <SuperFrame breadcrumbs={["Home", "Security Settings", "Security Questions"]} activeHref="/admin/account/security" title="Security Questions">
      {error ? <SaNotice tone="error">{error}</SaNotice> : null}
      {notice ? <SaNotice tone="success">{notice}</SaNotice> : null}
      {!questions ? (
        <p className="mh-sa__muted">Loading…</p>
      ) : (
        <form className="mh-sa__stack" onSubmit={onSubmit}>
          {questions.map((q, i) => {
            const choices = options.includes(q.question) || !q.question ? options : [q.question, ...options];
            return (
              <SaCard key={i} title={`SECURITY QUESTION ${i + 1}`}>
                <div className="mh-sa__form mh-sa__form--narrow">
                  <SaField label="Question">
                    <select className="mh-sa__input" value={q.question} onChange={(e) => update(i, { question: e.target.value, answered: false })}>
                      {choices.map((o) => (
                        <option key={o} disabled={questions.some((other, j) => j !== i && other.question === o)}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </SaField>
                  <SaField label="Answer" hint={q.answered ? "Saved — leave blank to keep" : undefined}>
                    <input
                      className="mh-sa__input"
                      value={q.answer}
                      onChange={(e) => update(i, { answer: e.target.value })}
                      placeholder={q.answered ? "••••••••" : ""}
                      required={!q.answered}
                      autoComplete="off"
                    />
                  </SaField>
                </div>
              </SaCard>
            );
          })}
          <p className="mh-sa__muted">Answers are stored securely and are not case-sensitive.</p>
          <div className="mh-sa__actions">
            <Link href="/admin/account/security" className="mh-sa__btn">
              Cancel
            </Link>
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
              {busy ? "Saving…" : "Save Questions"}
            </button>
          </div>
        </form>
      )}
    </SuperFrame>
  );
}

function offsetMinutes(tz: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

function offsetLabel(mins: number) {
  const sign = mins < 0 ? "-" : "+";
  const abs = Math.abs(mins);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

function formatInZone(tz: string, at: Date) {
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(at);
  } catch {
    return at.toISOString().replace("T", " ").slice(0, 19);
  }
}

export function SuperTimeZone() {
  const [current, setCurrent] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const zones = useMemo(() => {
    const at = new Date();
    const intl = Intl as typeof Intl & { supportedValuesOf?: (k: string) => string[] };
    const ids = intl.supportedValuesOf?.("timeZone") ?? ["UTC", "America/Vancouver", "America/Edmonton", "America/Toronto"];
    return ids
      .map((id) => {
        const mins = offsetMinutes(id, at);
        return { id, mins, label: `${offsetLabel(mins)} ${id.replace(/_/g, " ")}` };
      })
      .sort((a, b) => a.mins - b.mins || a.id.localeCompare(b.id));
  }, []);

  useEffect(() => {
    saApi<{ timezone: string }>("/me/timezone")
      .then((r) => {
        setCurrent(r.timezone);
        setSelected(r.timezone);
      })
      .catch((err) => setError(errorMessage(err, "Could not load time zone")));
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const r = await saApi<{ timezone: string }>("/me/timezone", { method: "PUT", body: JSON.stringify({ timezone: selected }) });
      setCurrent(r.timezone);
      setNotice("Time zone saved.");
    } catch (err) {
      setError(errorMessage(err, "Could not save time zone"));
    } finally {
      setBusy(false);
    }
  }

  const knownZone = zones.some((z) => z.id === selected);

  return (
    <SuperFrame breadcrumbs={["Home", "My Profile", "Change Time Zone"]} activeHref="/admin/account/timezone" title="Change Time Zone">
      {error ? <SaNotice tone="error">{error}</SaNotice> : null}
      {notice ? <SaNotice tone="success">{notice}</SaNotice> : null}
      <SaCard>
        <form className="mh-sa__form mh-sa__form--narrow" onSubmit={onSubmit}>
          <SaField label="Current Time">
            <output className="mh-sa__readonly">{current ? `${formatInZone(current, now)} (${current})` : "…"}</output>
          </SaField>
          <SaField label="New Time Zone">
            <select className="mh-sa__input" value={selected} onChange={(e) => setSelected(e.target.value)} required>
              {!knownZone && selected ? <option value={selected}>{selected}</option> : null}
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
          </SaField>
          <div className="mh-sa__actions">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy || !selected}>
              {busy ? "Saving…" : "Save Time Zone"}
            </button>
          </div>
        </form>
      </SaCard>
    </SuperFrame>
  );
}
