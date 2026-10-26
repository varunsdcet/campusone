"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TeacherSisShell } from "@/components/TeacherSisShell";
import { api, loadSession, type Session } from "@/lib/api";
import { FALLBACK_SEARCH_META, type SearchOption } from "@/lib/searchMeta";

type SearchItem = { id: string; label: string; sub?: string | null; href?: string | null };
type SearchGroup = { type: string; items: SearchItem[] };
type SearchMeta = {
  statuses: SearchOption[];
  campuses: SearchOption[];
  deliveryMethods: SearchOption[];
  domesticInternational: SearchOption[];
  programs: SearchOption[];
  months: SearchOption[];
  days: SearchOption[];
  years: SearchOption[];
};

type AdvancedForm = {
  status: string;
  sisEmail: string;
  lastName: string;
  firstName: string;
  middleName: string;
  preferredName: string;
  dobMonth: string;
  dobDay: string;
  dobYear: string;
  domesticInternational: string;
  streetAddress: string;
  city: string;
  postalCode: string;
  phoneNumber: string;
  email: string;
  discountCode: string;
  campus: string;
  deliveryMethod: string;
  program: string;
  studentNumber: string;
};

const EMPTY_FORM: AdvancedForm = {
  status: "",
  sisEmail: "",
  lastName: "",
  firstName: "",
  middleName: "",
  preferredName: "",
  dobMonth: "",
  dobDay: "",
  dobYear: "",
  domesticInternational: "",
  streetAddress: "",
  city: "",
  postalCode: "",
  phoneNumber: "",
  email: "",
  discountCode: "",
  campus: "",
  deliveryMethod: "",
  program: "",
  studentNumber: "",
};

function titleCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function groupIcon(type: string) {
  const key = type.toLowerCase();
  if (key.includes("student") || key.includes("people") || key.includes("person")) return "/brand/icons/user.svg";
  if (key.includes("course") || key.includes("section")) return "/brand/icons/school.svg";
  if (key.includes("message")) return "/brand/icons/user-check.svg";
  if (key.includes("assign") || key.includes("grade") || key.includes("document")) return "/brand/icons/file-text.svg";
  if (key.includes("calendar") || key.includes("event")) return "/brand/icons/calendar.svg";
  return "/brand/icons/search.svg";
}

function actionLabel(type: string) {
  const key = type.toLowerCase();
  if (key.includes("student")) return "View Profile";
  if (key.includes("course") || key.includes("section")) return "Open Course";
  if (key.includes("message")) return "Open Chat";
  if (key.includes("assign")) return "Open Assignment";
  return "Open";
}

function formFromParams(params: URLSearchParams): AdvancedForm {
  return {
    status: params.get("status") ?? "",
    sisEmail: params.get("sisEmail") ?? "",
    lastName: params.get("lastName") ?? "",
    firstName: params.get("firstName") ?? "",
    middleName: params.get("middleName") ?? "",
    preferredName: params.get("preferredName") ?? "",
    dobMonth: params.get("dobMonth") ?? "",
    dobDay: params.get("dobDay") ?? "",
    dobYear: params.get("dobYear") ?? "",
    domesticInternational: params.get("domesticInternational") ?? "",
    streetAddress: params.get("streetAddress") ?? "",
    city: params.get("city") ?? "",
    postalCode: params.get("postalCode") ?? "",
    phoneNumber: params.get("phoneNumber") ?? "",
    email: params.get("email") ?? "",
    discountCode: params.get("discountCode") ?? "",
    campus: params.get("campus") ?? "",
    deliveryMethod: params.get("deliveryMethod") ?? "",
    program: params.get("program") ?? "",
    studentNumber: params.get("studentNumber") ?? "",
  };
}

function hasAnyCriteria(form: AdvancedForm, q: string) {
  return Boolean(q.trim() || Object.values(form).some((v) => v.trim()));
}

export function InstructorSearchView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [form, setForm] = useState<AdvancedForm>(() => formFromParams(searchParams));
  const [meta, setMeta] = useState<SearchMeta>(FALLBACK_SEARCH_META);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const advanced =
    searchParams.get("advanced") === "1" ||
    Object.keys(EMPTY_FORM).some((key) => Boolean(searchParams.get(key)));
  const activeQuery = (searchParams.get("q") ?? "").trim();

  useEffect(() => {
    const active = loadSession();
    if (!active) {
      router.replace("/login");
      return;
    }
    if (!active.roles.includes("instructor")) {
      router.replace("/login");
      return;
    }
    setSession(active);
  }, [router]);

  useEffect(() => {
    if (!session || !advanced) return;
    api<SearchMeta>("/search/meta", {}, session.accessToken)
      .then((live) => {
        setMeta({
          ...FALLBACK_SEARCH_META,
          ...live,
          statuses: live.statuses?.length ? live.statuses : FALLBACK_SEARCH_META.statuses,
          campuses: live.campuses?.length ? live.campuses : FALLBACK_SEARCH_META.campuses,
          programs: live.programs?.length ? live.programs : FALLBACK_SEARCH_META.programs,
          deliveryMethods: live.deliveryMethods?.length ? live.deliveryMethods : FALLBACK_SEARCH_META.deliveryMethods,
          domesticInternational: live.domesticInternational?.length
            ? live.domesticInternational
            : FALLBACK_SEARCH_META.domesticInternational,
          months: live.months?.length ? live.months : FALLBACK_SEARCH_META.months,
          days: live.days?.length ? live.days : FALLBACK_SEARCH_META.days,
          years: live.years?.length ? live.years : FALLBACK_SEARCH_META.years,
        });
      })
      .catch(() => setMeta(FALLBACK_SEARCH_META));
  }, [session, advanced]);

  useEffect(() => {
    const next = formFromParams(searchParams);
    setForm(next);
    setQuery(searchParams.get("q") ?? "");
    setFilter("all");
    if (!session) {
      setGroups([]);
      return;
    }
    const params = new URLSearchParams();
    const qFromUrl = (searchParams.get("q") ?? "").trim();
    const nameBits = [next.lastName, next.firstName, next.preferredName, next.middleName]
      .map((v) => v.trim())
      .filter(Boolean);
    // Prefer explicit q; don't duplicate the same token from first/last name fields.
    const qParts = [qFromUrl, ...nameBits.filter((bit) => bit.toLowerCase() !== qFromUrl.toLowerCase())];
    const composed = [qParts.join(" "), next.studentNumber, next.email, next.sisEmail, next.program.split(":")[0], next.city]
      .map((v) => v.trim())
      .filter(Boolean);
    // Dedupe tokens so q=Brown&firstName=Brown does not become "Brown Brown".
    const seenTok = new Set<string>();
    const q = composed
      .join(" ")
      .split(/\s+/)
      .filter((t) => {
        const key = t.toLowerCase();
        if (!key || seenTok.has(key)) return false;
        seenTok.add(key);
        return true;
      })
      .join(" ");
    const hasFilters = Object.values(next).some((v) => v.trim()) || Boolean(qFromUrl);
    const qFinal = q || (hasFilters ? "ST-" : "");
    if (qFinal) params.set("q", qFinal);
    for (const [key, value] of Object.entries(next)) {
      if (value.trim()) params.set(key, value.trim());
    }
    if (![...params.keys()].length) {
      setGroups([]);
      return;
    }
    setBusy(true);
    setError(null);
    api<{ groups: SearchGroup[] }>(`/search?${params.toString()}`, {}, session.accessToken)
      .then((result) => {
        const raw = result.groups || [];
        setGroups(applyClientAdvancedFilters(raw, next));
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Search failed"))
      .finally(() => setBusy(false));
  }, [searchParams, session]);

  function applyClientAdvancedFilters(raw: SearchGroup[], f: AdvancedForm): SearchGroup[] {
    const wantsStudentsOnly = Object.values(f).some((v) => v.trim());
    return raw
      .map((group) => {
        if (group.type !== "students" && wantsStudentsOnly) {
          // Advanced student search should not mix course hits unless no student filters.
          return { ...group, items: [] };
        }
        const items = group.items.filter((item) => {
          const label = (item.label || "").toLowerCase();
          const sub = (item.sub || "").toLowerCase();
          const hay = `${label} ${sub}`;
          if (f.lastName && !label.includes(f.lastName.toLowerCase())) return false;
          if (f.firstName && !label.includes(f.firstName.toLowerCase())) return false;
          if (f.middleName && !hay.includes(f.middleName.toLowerCase())) return false;
          if (f.preferredName && !hay.includes(f.preferredName.toLowerCase())) return false;
          if (f.studentNumber && !hay.includes(f.studentNumber.toLowerCase())) return false;
          if (f.email && !hay.includes(f.email.toLowerCase())) return false;
          if (f.sisEmail && !hay.includes(f.sisEmail.toLowerCase())) return false;
          if (f.program) {
            const code = f.program.split(":")[0].trim().toLowerCase();
            const name = f.program.toLowerCase();
            if (!hay.includes(code) && !hay.includes(name)) return false;
          }
          if (f.status) {
            const st = f.status.toLowerCase();
            const statusAliases: Record<string, string[]> = {
              "active student": ["active student", "enrolled", "active"],
              "registered student": ["registered student", "registered", "completed"],
              "withdrawn students": ["withdrawn students", "withdrawn"],
              "leave of absence": ["leave of absence", "leave", "loa"],
              "on-hold": ["on-hold", "hold", "probation"],
              "follow up": ["follow up", "alert", "warning", "follow"],
              "new inquiry": ["new inquiry", "inquiry"],
              "approved application": ["approved application", "approved"],
              "pre-enrolment application": ["pre-enrolment", "pre-enroll"],
            };
            const aliases = statusAliases[st] || [st];
            if (!aliases.some((a) => hay.includes(a))) return false;
          }
          if (f.city && !hay.includes(f.city.toLowerCase())) return false;
          if (f.campus) {
            const c = f.campus.toLowerCase();
            // Campus is institutional; if not in row text, allow Surrey default through.
            if (!hay.includes(c) && !(c.includes("surrey") || c.includes("all"))) {
              /* keep row — campus metadata often not on roster row */
            }
          }
          if (f.domesticInternational) {
            const di = f.domesticInternational.toLowerCase();
            const intl = /intl|international|offshore|visa/.test(hay);
            if (di === "international" && !intl) return false;
            if (di === "domestic" && intl) return false;
          }
          return true;
        });
        return { ...group, items };
      })
      .filter((g) => g.items.length > 0);
  }

  const total = useMemo(() => groups.reduce((sum, group) => sum + group.items.length, 0), [groups]);

  const filters = useMemo(() => {
    const tabs = [{ id: "all", label: `All (${total})` }];
    for (const group of groups) {
      tabs.push({ id: group.type, label: `${titleCase(group.type)} (${group.items.length})` });
    }
    return tabs;
  }, [groups, total]);

  const visibleGroups = useMemo(() => {
    if (filter === "all") return groups;
    return groups.filter((group) => group.type === filter);
  }, [filter, groups]);

  function setField<K extends keyof AdvancedForm>(key: K, value: AdvancedForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onQuickSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(`/instructor/search?q=${encodeURIComponent(query.trim())}`);
  }

  function onAdvancedSearch(event: FormEvent) {
    event.preventDefault();
    if (!hasAnyCriteria(form, query)) return;
    const params = new URLSearchParams({ advanced: "1" });
    for (const [key, value] of Object.entries(form)) {
      if (value.trim()) params.set(key, value.trim());
    }
    const composed = [form.studentNumber, form.lastName, form.firstName, form.email, form.sisEmail, query]
      .map((v) => v.trim())
      .filter(Boolean)
      .join(" ");
    if (composed) params.set("q", composed);
    router.push(`/instructor/search?${params.toString()}`);
  }

  const userName = session ? `${session.givenName} ${session.familyName}`.trim() : "Instructor";
  const hasCriteria = hasAnyCriteria(formFromParams(searchParams), activeQuery);
  const programs = meta.programs;
  const statuses = meta.statuses;
  const campuses = meta.campuses;
  const deliveries = meta.deliveryMethods;
  const domestic = meta.domesticInternational;
  const months = meta.months;
  const days = meta.days;
  const years = meta.years;
  const programGroups = useMemo(() => {
    const map = new Map<string, SearchOption[]>();
    for (const o of programs) {
      if (!o.value) continue;
      const g = o.group || "PROGRAMS";
      const list = map.get(g) || [];
      list.push(o);
      map.set(g, list);
    }
    return map;
  }, [programs]);

  return (
    <TeacherSisShell
      activeHref="/instructor/search"
      title={advanced ? "Search Students" : "Search Results"}
      subtitle={
        activeQuery || hasCriteria
          ? `${total} result${total === 1 ? "" : "s"}`
          : advanced
            ? "Home › Students › Search Results"
            : "Find students, courses, messages, and campus records."
      }
      userName={userName || "Instructor"}
      hideSignOut
    >
      <div className="mh-teacher-search" data-figma-id="178:121">
        {advanced ? (
          <form className="mh-sis-adv" onSubmit={onAdvancedSearch}>
            <div className="mh-sis-adv__top">
              <div>
                <p className="mh-sis-adv__crumb">Home › Students › Search Results</p>
                <h1 className="mh-sis-adv__title">SEARCH STUDENTS</h1>
              </div>
              <button type="button" className="mh-sis-adv__simple" onClick={() => router.push("/instructor/search")}>
                SIMPLE SEARCH
              </button>
            </div>

            <div className="mh-sis-adv__grid">
              <label className="mh-sis-adv__field">
                <span>STATUS</span>
                <select value={form.status} onChange={(e) => setField("status", e.target.value)}>
                  {statuses.map((o) => (
                    <option key={`${o.value}-${o.label}`} value={o.value}>
                      {o.indent ? `    ${o.label}` : o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mh-sis-adv__field">
                <span>SIS E-MAIL ADDRESS</span>
                <input value={form.sisEmail} onChange={(e) => setField("sisEmail", e.target.value)} />
              </label>
              <label className="mh-sis-adv__field">
                <span>LAST NAME</span>
                <input value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} />
              </label>

              <label className="mh-sis-adv__field">
                <span>FIRST NAME</span>
                <input value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} />
              </label>
              <label className="mh-sis-adv__field">
                <span>MIDDLE NAME</span>
                <input value={form.middleName} onChange={(e) => setField("middleName", e.target.value)} />
              </label>
              <label className="mh-sis-adv__field">
                <span>PREFERRED NAME</span>
                <input value={form.preferredName} onChange={(e) => setField("preferredName", e.target.value)} />
              </label>

              <label className="mh-sis-adv__field">
                <span>DATE OF BIRTH</span>
                <div className="mh-sis-adv__dob">
                  <select value={form.dobMonth} onChange={(e) => setField("dobMonth", e.target.value)}>
                    {months.map((o) => (
                      <option key={o.value || o.label} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select value={form.dobDay} onChange={(e) => setField("dobDay", e.target.value)}>
                    {days.map((o) => (
                      <option key={o.value || o.label} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select value={form.dobYear} onChange={(e) => setField("dobYear", e.target.value)}>
                    {years.map((o) => (
                      <option key={o.value || o.label} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
              <label className="mh-sis-adv__field">
                <span>DOMESTIC / INTERNATIONAL</span>
                <select
                  value={form.domesticInternational}
                  onChange={(e) => setField("domesticInternational", e.target.value)}
                >
                  {domestic.map((o) => (
                    <option key={o.value || o.label} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mh-sis-adv__field">
                <span>STREET ADDRESS</span>
                <input value={form.streetAddress} onChange={(e) => setField("streetAddress", e.target.value)} />
              </label>

              <label className="mh-sis-adv__field">
                <span>CITY</span>
                <input value={form.city} onChange={(e) => setField("city", e.target.value)} />
              </label>
              <label className="mh-sis-adv__field">
                <span>POSTAL / ZIP CODE</span>
                <input value={form.postalCode} onChange={(e) => setField("postalCode", e.target.value)} />
              </label>
              <label className="mh-sis-adv__field">
                <span>PHONE NUMBER</span>
                <input value={form.phoneNumber} onChange={(e) => setField("phoneNumber", e.target.value)} />
              </label>

              <label className="mh-sis-adv__field">
                <span>E-MAIL ADDRESS</span>
                <input value={form.email} onChange={(e) => setField("email", e.target.value)} />
              </label>
              <label className="mh-sis-adv__field">
                <span>DISCOUNT CODE</span>
                <input value={form.discountCode} onChange={(e) => setField("discountCode", e.target.value)} />
              </label>
              <label className="mh-sis-adv__field">
                <span>CAMPUS</span>
                <select value={form.campus} onChange={(e) => setField("campus", e.target.value)}>
                  {campuses.map((o) => (
                    <option key={o.value || o.label} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mh-sis-adv__field">
                <span>DELIVERY METHOD</span>
                <select value={form.deliveryMethod} onChange={(e) => setField("deliveryMethod", e.target.value)}>
                  {deliveries.map((o) => (
                    <option key={o.value || o.label} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mh-sis-adv__field mh-sis-adv__field--span2">
                <span>PROGRAM</span>
                <select value={form.program} onChange={(e) => setField("program", e.target.value)}>
                  <option value="">All Programs</option>
                  {[...programGroups.entries()].map(([group, opts]) => (
                    <optgroup key={group} label={group}>
                      {opts.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>

            <div className="mh-sis-adv__foot">
              <button type="submit" className="mh-sis-adv__submit" disabled={busy || !hasAnyCriteria(form, query)}>
                {busy ? "Searching…" : "Search Students"}
              </button>
            </div>
          </form>
        ) : (
          <form className="mh-teacher-search__hero" onSubmit={onQuickSearch}>
            <label className="mh-teacher-search__field">
              <img src="/brand/icons/search.svg" alt="" width={18} height={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Student # or last name"
                aria-label="Search instructor portal"
                autoFocus
              />
              {query ? (
                <button
                  type="button"
                  className="mh-teacher-search__clear"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    router.push("/instructor/search");
                  }}
                >
                  ×
                </button>
              ) : null}
            </label>
            <button type="submit" className="mh-teacher-btn mh-teacher-btn--primary" disabled={busy || !query.trim()}>
              {busy ? "Searching…" : "Search"}
            </button>
            <button type="button" className="mh-teacher-link" onClick={() => router.push("/instructor/search?advanced=1")}>
              Advanced Search
            </button>
          </form>
        )}

        {error ? <div className="mh-teacher-search__error">{error}</div> : null}

        {hasCriteria && groups.length > 0 ? (
          <div className="mh-teacher-search__filters" role="tablist" aria-label="Result filters">
            {filters.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                className={`mh-teacher-search__filter${filter === tab.id ? " is-active" : ""}`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        {!busy && !hasCriteria ? (
          <div className="mh-teacher-card mh-teacher-search__empty">
            <img src="/brand/icons/search.svg" alt="" width={28} height={28} />
            <h3>{advanced ? "Search Students" : "Search CampusOne"}</h3>
            <p>
              {advanced
                ? "Use any combination of status, name, campus, program, or contact fields. Results come from your live roster API."
                : "Look up students, sections, messages, and academic records available to your instructor account."}
            </p>
          </div>
        ) : null}

        {!busy && hasCriteria && total === 0 ? (
          <div className="mh-teacher-card mh-teacher-search__empty">
            <h3>No students matched these filters</h3>
            <p>Adjust status, name, program, or campus and search again.</p>
          </div>
        ) : null}

        <div className="mh-teacher-search__list">
          {visibleGroups.map((group) =>
            group.items.map((item) => (
              <article
                key={`${group.type}-${item.id}`}
                className={`mh-teacher-search__card${item.href ? " is-clickable" : ""}`}
                onClick={(e) => {
                  if (item.href && !(e.target as HTMLElement).closest("a")) router.push(item.href);
                }}
              >
                <div className="mh-teacher-search__icon">
                  <img src={groupIcon(group.type)} alt="" width={18} height={18} />
                </div>
                <div className="mh-teacher-search__body">
                  <div className="mh-teacher-search__title-row">
                    <strong>{item.label}</strong>
                    <span className="mh-teacher-badge is-active">{titleCase(group.type)}</span>
                  </div>
                  {item.sub ? <p className="mh-teacher-search__meta">{item.sub}</p> : null}
                </div>
                {item.href ? (
                  <Link href={item.href} role="button" className="mh-teacher-btn mh-teacher-btn--secondary">
                    {actionLabel(group.type)}
                  </Link>
                ) : null}
              </article>
            )),
          )}
        </div>
      </div>
    </TeacherSisShell>
  );
}
