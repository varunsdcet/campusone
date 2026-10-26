"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  errorMessage,
  qs,
  saApi,
  type AccessLevel,
  type PermissionMap,
  type SuperMeta,
  type UserDetail,
  type UserRow,
} from "@/lib/superAdmin";
import { useMyAccess } from "@/lib/access";
import { PermissionMatrix } from "./PermissionMatrix";
import { SaCard, SaField, SaNotice, SuperFrame } from "./shared";

function useMetaAndLevels() {
  const [meta, setMeta] = useState<SuperMeta | null>(null);
  const [levels, setLevels] = useState<AccessLevel[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([saApi<SuperMeta>("/meta"), saApi<{ items: AccessLevel[] }>("/access-levels")])
      .then(([m, l]) => {
        setMeta(m);
        setLevels(l.items);
      })
      .catch((err) => setError(errorMessage(err, "Could not load access levels")));
  }, []);
  return { meta, levels, error };
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const suggestLogin = (givenName: string, familyName: string) => `${givenName}.${familyName}`.replace(/[^A-Za-z0-9._-]/g, "").toLowerCase();

/* ------------------------------ Directory ------------------------------ */

export function SuperUserDirectory() {
  const router = useRouter();
  const params = useSearchParams();
  const { levels, error: levelsError } = useMetaAndLevels();
  const q = params.get("q") ?? "";
  const accessLevel = params.get("accessLevel") ?? "";
  const letter = params.get("letter") ?? "";
  const page = Number(params.get("page") ?? 1) || 1;
  const perPage = Number(params.get("perPage") ?? 50) || 50;
  const [draft, setDraft] = useState({ q, accessLevel });
  const [data, setData] = useState<{ total: number; items: UserRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft({ q, accessLevel }), [q, accessLevel]);

  useEffect(() => {
    setData(null);
    saApi<{ total: number; items: UserRow[] }>(`/users${qs({ q, accessLevel, letter, page, perPage })}`)
      .then((r) => {
        setData(r);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err, "Could not load users")));
  }, [q, accessLevel, letter, page, perPage]);

  const go = (next: Record<string, string | number>) => {
    router.push(`/admin/user-management${qs({ q, accessLevel, letter, perPage, ...next })}`);
  };

  function onSearch(e: FormEvent) {
    e.preventDefault();
    go({ q: draft.q, accessLevel: draft.accessLevel, page: 1 });
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / perPage)) : 1;

  return (
    <SuperFrame
      breadcrumbs={["Home", "User Management", "User Directory"]}
      activeHref="/admin/user-management"
      title="User Directory"
      actions={
        <Link href="/admin/user-management/new" className="mh-sa__btn mh-sa__btn--primary">
          Create User
        </Link>
      }
    >
      {error || levelsError ? <SaNotice tone="error">{error || levelsError}</SaNotice> : null}
      <SaCard>
        <form className="mh-sa__grid mh-sa__grid--search" onSubmit={onSearch}>
          <SaField label="NAME OR LOGIN">
            <input className="mh-sa__input" placeholder="Enter Name or Login" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
          </SaField>
          <SaField label="ACCESS LEVEL">
            <select className="mh-sa__input" value={draft.accessLevel} onChange={(e) => setDraft({ ...draft, accessLevel: e.target.value })}>
              <option value="">All Access Levels</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </SaField>
          <div className="mh-sa__field mh-sa__field--end">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
              Search Users
            </button>
          </div>
        </form>
        <nav className="mh-sa-alpha" aria-label="Filter by last name">
          <button type="button" className={!letter ? "is-active" : ""} onClick={() => go({ letter: "", page: 1 })}>
            ALL
          </button>
          {LETTERS.map((l) => (
            <button key={l} type="button" className={letter === l ? "is-active" : ""} onClick={() => go({ letter: l, page: 1 })}>
              {l}
            </button>
          ))}
        </nav>
      </SaCard>

      <SaCard>
        <div className="mh-sa-results">
          <span>
            Results: <strong>{data ? data.total.toLocaleString() : "…"}</strong>
          </span>
          <label>
            Per Page:{" "}
            <select value={perPage} onChange={(e) => go({ perPage: Number(e.target.value), page: 1 })}>
              {[25, 50, 100, 200].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <span>
            Page:{" "}
            <button type="button" className="mh-sa__link" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
              ‹
            </button>{" "}
            <strong>{page}</strong> of {pages}{" "}
            <button type="button" className="mh-sa__link" disabled={page >= pages} onClick={() => go({ page: page + 1 })}>
              ›
            </button>
          </span>
        </div>
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Access Level</th>
                <th className="mh-sa__col-action">Edit</th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr>
                  <td colSpan={3} className="mh-sa__empty-cell">
                    Loading…
                  </td>
                </tr>
              ) : data.items.length ? (
                data.items.map((u) => (
                  <tr key={u.accountId} className={u.disabled ? "is-disabled" : ""}>
                    <td>
                      <Link href={`/admin/faculty-profile/biography?user=${u.accountId}`}>
                        {u.familyName}, {u.givenName}
                      </Link>
                      <div className="mh-sa__sub">
                        {u.login ? `${u.login} · ` : ""}
                        {u.email}
                        {u.disabled ? " · Disabled" : ""}
                      </div>
                    </td>
                    <td>{u.accessLevel}</td>
                    <td className="mh-sa__col-action">
                      <Link href={`/admin/user-management/edit?id=${u.accountId}`} className="mh-sa__btn mh-sa__btn--sm">
                        EDIT
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="mh-sa__empty-cell">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SaCard>
    </SuperFrame>
  );
}

/* ------------------------------ Add / Edit user ------------------------------ */

type UserForm = Omit<UserDetail, "accountId"> & { password: string; confirmPassword: string };

const BLANK: UserForm = {
  givenName: "",
  familyName: "",
  preferredName: "",
  email: "",
  phone: "",
  title: "",
  department: "",
  postNominals: "",
  employeeNumber: "",
  login: "",
  password: "",
  confirmPassword: "",
  instructing: false,
  disabled: false,
  accessLevelId: "",
  customizeAccess: false,
  permissions: {},
  customizeRegional: false,
  campuses: [],
};

export function SuperUserForm() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const { meta, levels, error: loadError } = useMetaAndLevels();
  const access = useMyAccess();
  const [form, setForm] = useState<UserForm | null>(id ? null : BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loginEdited, setLoginEdited] = useState(false);

  useEffect(() => {
    if (!id) return;
    saApi<UserDetail>(`/users/${encodeURIComponent(id)}`)
      .then((u) => setForm({ ...u, password: "", confirmPassword: "" }))
      .catch((err) => setError(errorMessage(err, "Could not load user")));
  }, [id]);

  const presetLevel = id ? null : params.get("accessLevel");
  useEffect(() => {
    if (!presetLevel) return;
    const preset = levels.find((l) => l.id === presetLevel);
    if (!preset) return;
    setForm((f) =>
      f && !f.accessLevelId
        ? { ...f, accessLevelId: preset.id, permissions: preset.permissions, instructing: f.instructing || preset.profileType === "Faculty" }
        : f,
    );
  }, [presetLevel, levels]);

  const level = levels.find((l) => l.id === form?.accessLevelId);
  const levelDefaults: PermissionMap | undefined = level?.permissions;

  const loginSuggestion = useMemo(() => {
    if (!form || form.login || !form.givenName || !form.familyName) return "";
    return suggestLogin(form.givenName, form.familyName);
  }, [form]);

  if (!form) {
    return (
      <SuperFrame breadcrumbs={["Home", "User Management", "Edit User"]} activeHref="/admin/user-management">
        {error || loadError ? <SaNotice tone="error">{error || loadError}</SaNotice> : <p className="mh-sa__muted">Loading…</p>}
      </SuperFrame>
    );
  }

  const set = <K extends keyof UserForm>(k: K, v: UserForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  /** On Add User the required login follows the name until the admin types their own, so the first Save is not blocked by an empty login. */
  const setName = (k: "givenName" | "familyName", v: string) =>
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, [k]: v };
      if (!id && !loginEdited && next.givenName && next.familyName) next.login = suggestLogin(next.givenName, next.familyName);
      return next;
    });

  function changeLevel(accessLevelId: string) {
    const next = levels.find((l) => l.id === accessLevelId);
    setForm((f) => (f ? { ...f, accessLevelId, permissions: next ? next.permissions : f.permissions } : f));
  }

  function toggleCustomizeAccess(on: boolean) {
    setForm((f) => (f ? { ...f, customizeAccess: on, permissions: levelDefaults ?? f.permissions } : f));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setNotice(null);
    if (!id && !form.password) {
      setError("New Password is required.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("New Password and Confirm Password do not match.");
      return;
    }
    if (form.customizeRegional && !form.campuses.length) {
      setError("Select at least one campus, or turn off Customize Regional Access.");
      return;
    }
    setBusy(true);
    try {
      const { confirmPassword: _confirm, password, ...rest } = form;
      const saved = await saApi<UserDetail>(id ? `/users/${encodeURIComponent(id)}` : "/users", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({ ...rest, ...(password ? { password } : {}) }),
      });
      if (!id) {
        router.replace(`/admin/user-management/edit?id=${saved.accountId}&created=1`);
        return;
      }
      setForm({ ...saved, password: "", confirmPassword: "" });
      setNotice("User saved.");
    } catch (err) {
      setError(errorMessage(err, "Could not save user"));
    } finally {
      setBusy(false);
    }
  }

  const accessLoading = access === undefined;
  const assignAll = Boolean(access && (access.superAdmin || access.accessLevelId === "admin"));
  const assignable = levels.filter((l) => l.id === form.accessLevelId || (!accessLoading && (assignAll || l.assignableByNonAdmins)));
  const campuses = meta?.campuses ?? [];
  const allCampuses = campuses.length > 0 && campuses.every((c) => form.campuses.includes(c));

  return (
    <SuperFrame
      breadcrumbs={["Home", "User Management", id ? "Edit User" : "Add User"]}
      activeHref={id ? "/admin/user-management" : "/admin/user-management/new"}
      title={id ? `Edit User — ${form.givenName} ${form.familyName}` : "Add User"}
      actions={
        id ? (
          <Link href={`/admin/faculty-profile/biography?user=${id}`} className="mh-sa__btn">
            View Profile
          </Link>
        ) : null
      }
    >
      {params.get("created") && !notice && !error ? <SaNotice tone="success">User created.</SaNotice> : null}
      {notice ? <SaNotice tone="success">{notice}</SaNotice> : null}
      {error || loadError ? <SaNotice tone="error">{error || loadError}</SaNotice> : null}

      <form className="mh-sa__stack" onSubmit={onSubmit}>
        <SaCard title="USER DETAILS">
          <div className="mh-sa__grid">
            <SaField label="First Name">
              <input className="mh-sa__input" value={form.givenName} onChange={(e) => setName("givenName", e.target.value)} required maxLength={80} />
            </SaField>
            <SaField label="Last Name">
              <input className="mh-sa__input" value={form.familyName} onChange={(e) => setName("familyName", e.target.value)} required maxLength={80} />
            </SaField>
            <SaField label="Preferred Name">
              <input className="mh-sa__input" value={form.preferredName} onChange={(e) => set("preferredName", e.target.value)} maxLength={80} />
            </SaField>
            <SaField label="E-mail Address">
              <input className="mh-sa__input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </SaField>
            <SaField label="Phone Number">
              <input className="mh-sa__input" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={40} />
            </SaField>
          </div>
        </SaCard>

        <SaCard title="USER PROFILE">
          <div className="mh-sa__grid">
            <SaField label="Title / Position">
              <input className="mh-sa__input" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} />
            </SaField>
            <SaField label="Post-Nominals">
              <input className="mh-sa__input" value={form.postNominals} onChange={(e) => set("postNominals", e.target.value)} maxLength={80} />
            </SaField>
            <SaField label="Employee Number">
              <input className="mh-sa__input" value={form.employeeNumber} onChange={(e) => set("employeeNumber", e.target.value)} maxLength={40} />
            </SaField>
            <SaField label="Department / Area">
              <input className="mh-sa__input" value={form.department} onChange={(e) => set("department", e.target.value)} maxLength={120} />
            </SaField>
          </div>
        </SaCard>

        <SaCard title="USER LOGIN">
          <div className="mh-sa__grid">
            <SaField label="User Login" hint={loginSuggestion ? `e.g. ${loginSuggestion}` : undefined}>
              <input
                className="mh-sa__input"
                value={form.login}
                onChange={(e) => {
                  setLoginEdited(true);
                  set("login", e.target.value);
                }}
                onFocus={() => loginSuggestion && set("login", loginSuggestion)}
                required
                minLength={3}
                maxLength={64}
                pattern="[A-Za-z0-9._\-]+"
                title="Letters, numbers, dots, dashes and underscores"
                autoComplete="off"
              />
            </SaField>
            <SaField label="New Password" hint={id ? "Leave blank to keep current" : undefined}>
              <input
                className="mh-sa__input"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                minLength={8}
                required={!id}
              />
            </SaField>
            <SaField label="Confirm Password">
              <input
                className="mh-sa__input"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => set("confirmPassword", e.target.value)}
                required={!id || Boolean(form.password)}
              />
            </SaField>
          </div>
          <p className="mh-sa__muted">The user can sign in with either their e-mail address or this user login.</p>
        </SaCard>

        <SaCard title="USER ACCESS">
          <div className="mh-sa__stack mh-sa__stack--tight">
            <label className="mh-sa__check">
              <input type="checkbox" checked={form.instructing} onChange={(e) => set("instructing", e.target.checked)} />
              This user will be instructing courses
            </label>
            <label className="mh-sa__check">
              <input type="checkbox" checked={form.disabled} onChange={(e) => set("disabled", e.target.checked)} />
              Disable this Account
            </label>
            <SaField label="Access Level">
              <select
                className="mh-sa__input mh-sa__input--auto"
                value={form.accessLevelId}
                onChange={(e) => changeLevel(e.target.value)}
                disabled={accessLoading}
                required
              >
                <option value="">{accessLoading ? "Loading…" : "Select Access Level"}</option>
                {assignable.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </SaField>
            <label className="mh-sa__check">
              <input type="checkbox" checked={form.customizeAccess} disabled={!level} onChange={(e) => toggleCustomizeAccess(e.target.checked)} />
              Customize Access Level
            </label>
            <label className="mh-sa__check">
              <input
                type="checkbox"
                checked={form.customizeRegional}
                onChange={(e) => setForm((f) => (f ? { ...f, customizeRegional: e.target.checked, campuses: e.target.checked ? f.campuses : [...campuses] } : f))}
              />
              Customize Regional Access
            </label>
          </div>
        </SaCard>

        {form.customizeAccess && meta && level ? (
          <SaCard title="CUSTOMIZE PERMISSIONS">
            <p className="mh-sa__muted">
              Defaults come from the <strong>{level.name}</strong> access level. Tick Override on a module to change it for this user only.
            </p>
            <PermissionMatrix
              modules={meta.permissionModules}
              value={form.permissions}
              defaults={levelDefaults}
              mode="user"
              onChange={(permissions) => set("permissions", permissions)}
            />
          </SaCard>
        ) : null}

        {form.customizeRegional ? (
          <SaCard title="CUSTOMIZE REGIONAL PERMISSIONS">
            <div className="mh-sa__field">
              <span className="mh-sa__label">
                Campus Access <em>{form.campuses.length} of {campuses.length} campuses</em>
              </span>
              <label className="mh-sa__check">
                <input type="checkbox" checked={allCampuses} onChange={(e) => set("campuses", e.target.checked ? [...campuses] : [])} />
                All Campuses
              </label>
              <div className="mh-sa-campus">
                {campuses.map((c) => (
                  <label key={c} className="mh-sa__check">
                    <input
                      type="checkbox"
                      checked={form.campuses.includes(c)}
                      onChange={(e) => set("campuses", e.target.checked ? [...form.campuses, c] : form.campuses.filter((x) => x !== c))}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          </SaCard>
        ) : null}

        <div className="mh-sa__actions">
          <Link href="/admin/user-management" className="mh-sa__btn">
            Cancel
          </Link>
          <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy || accessLoading}>
            {busy ? "Saving…" : "Save User"}
          </button>
        </div>
      </form>
    </SuperFrame>
  );
}

/* ------------------------------ Access levels ------------------------------ */

export function SuperAccessLevels() {
  const [levels, setLevels] = useState<AccessLevel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () =>
    saApi<{ items: AccessLevel[] }>("/access-levels")
      .then((r) => setLevels(r.items))
      .catch((err) => setError(errorMessage(err, "Could not load access levels")));

  useEffect(() => {
    void load();
  }, []);

  async function onDelete(level: AccessLevel) {
    if (!window.confirm(`Delete the "${level.name}" access level?`)) return;
    setError(null);
    setNotice(null);
    try {
      await saApi(`/access-levels/${encodeURIComponent(level.id)}`, { method: "DELETE" });
      setNotice(`${level.name} deleted.`);
      await load();
    } catch (err) {
      setError(errorMessage(err, "Delete failed"));
    }
  }

  return (
    <SuperFrame
      breadcrumbs={["Home", "User Management", "Manage Access Levels"]}
      activeHref="/admin/access-levels"
      title="Manage Access Levels"
      actions={
        <Link href="/admin/access-levels/new" className="mh-sa__btn mh-sa__btn--primary">
          Add Access Level
        </Link>
      }
    >
      {error ? <SaNotice tone="error" onClose={() => setError(null)}>{error}</SaNotice> : null}
      {notice ? <SaNotice tone="success">{notice}</SaNotice> : null}
      <SaCard>
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table">
            <thead>
              <tr>
                <th>Access Name</th>
                <th>Profile Type</th>
                <th className="mh-sa__col-action">Edit</th>
                <th className="mh-sa__col-action">Delete</th>
              </tr>
            </thead>
            <tbody>
              {!levels ? (
                <tr>
                  <td colSpan={4} className="mh-sa__empty-cell">
                    Loading…
                  </td>
                </tr>
              ) : (
                levels
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((l) => (
                    <tr key={l.id}>
                      <td>{l.name}</td>
                      <td>{l.profileType}</td>
                      <td className="mh-sa__col-action">
                        <Link href={`/admin/access-levels/edit?id=${encodeURIComponent(l.id)}`} className="mh-sa__btn mh-sa__btn--sm">
                          EDIT
                        </Link>
                      </td>
                      <td className="mh-sa__col-action">
                        <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => onDelete(l)}>
                          DELETE
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </SaCard>
    </SuperFrame>
  );
}

export function SuperAccessLevelForm() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const { meta, levels, error: loadError } = useMetaAndLevels();
  const [form, setForm] = useState<Omit<AccessLevel, "id"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!meta) return;
    if (id) {
      const existing = levels.find((l) => l.id === id);
      if (existing) setForm({ name: existing.name, profileType: existing.profileType, assignableByNonAdmins: existing.assignableByNonAdmins, permissions: existing.permissions });
      else if (levels.length) setError("Access level not found.");
      return;
    }
    setForm({
      name: "",
      profileType: meta.profileTypes[0] ?? "Staff",
      assignableByNonAdmins: false,
      permissions: Object.fromEntries(meta.permissionModules.map((m) => [m.key, { override: false, level: "none" as const }])),
    });
  }, [id, meta, levels]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await saApi<AccessLevel>(id ? `/access-levels/${encodeURIComponent(id)}` : "/access-levels", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      if (!id) {
        router.replace(`/admin/access-levels/edit?id=${encodeURIComponent(saved.id)}`);
        return;
      }
      setNotice("Access level saved.");
    } catch (err) {
      setError(errorMessage(err, "Could not save access level"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SuperFrame
      breadcrumbs={["Home", "Manage Access Levels", id ? "Edit Access Level" : "Add Access Level"]}
      activeHref="/admin/access-levels"
      title={id ? `Edit Access Level${form?.name ? ` — ${form.name}` : ""}` : "Add Access Level"}
    >
      {notice ? <SaNotice tone="success">{notice}</SaNotice> : null}
      {error || loadError ? <SaNotice tone="error">{error || loadError}</SaNotice> : null}
      {!form || !meta ? (
        <p className="mh-sa__muted">Loading…</p>
      ) : (
        <form className="mh-sa__stack" onSubmit={onSubmit}>
          <SaCard title="ACCESS LEVEL DETAILS">
            <div className="mh-sa__grid">
              <SaField label="Access Level Name">
                <input className="mh-sa__input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} />
              </SaField>
              <SaField label="Profile Type">
                <select className="mh-sa__input" value={form.profileType} onChange={(e) => setForm({ ...form, profileType: e.target.value })}>
                  {meta.profileTypes.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </SaField>
              <div className="mh-sa__field">
                <span className="mh-sa__label">Assignable by Non-Administrators</span>
                <div className="mh-sa__inline">
                  <label className="mh-sa__check">
                    <input type="radio" name="assignable" checked={form.assignableByNonAdmins} onChange={() => setForm({ ...form, assignableByNonAdmins: true })} />
                    Yes
                  </label>
                  <label className="mh-sa__check">
                    <input type="radio" name="assignable" checked={!form.assignableByNonAdmins} onChange={() => setForm({ ...form, assignableByNonAdmins: false })} />
                    No
                  </label>
                </div>
              </div>
            </div>
          </SaCard>
          <SaCard title="PERMISSIONS">
            <PermissionMatrix modules={meta.permissionModules} value={form.permissions} mode="level" onChange={(permissions) => setForm({ ...form, permissions })} />
          </SaCard>
          <div className="mh-sa__actions">
            <Link href="/admin/access-levels" className="mh-sa__btn">
              Cancel
            </Link>
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
              {busy ? "Saving…" : "Save Access Level"}
            </button>
          </div>
        </form>
      )}
    </SuperFrame>
  );
}
