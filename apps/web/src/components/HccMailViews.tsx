"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, loadSession, type Session } from "@/lib/api";

export type HccMailRole = "student" | "instructor" | "admin";

type Folder = { id: string; name: string; kind: string; unreadCount: number; sortOrder?: number };
type ThreadRow = {
  id: string;
  subject: string;
  preview: string;
  participants: string[];
  otherName?: string;
  updatedAt: string;
  readAt: string | null;
  folderKind?: string;
  flagged?: boolean;
};
type ThreadDetail = {
  id: string;
  subject: string;
  messageType?: string;
  folderKind: string;
  flagged: boolean;
  from: { accountId?: string; name: string; email: string } | null;
  to: Array<{ accountId?: string; name: string; email: string }>;
  cc: Array<{ name: string; email: string }>;
  bcc: Array<{ name: string; email: string }>;
  messages: Array<{
    id: string;
    from: string;
    senderAccountId?: string;
    senderName: string;
    senderEmail: string;
    text: string;
    time: string;
  }>;
};
type Settings = {
  emailAddress?: string;
  forwardingEnabled: boolean;
  forwardingAddress: string | null;
  smsForwardingEnabled: boolean;
  signature: string | null;
  popupNotifications: boolean;
  notificationSound: boolean;
  autoResponderEnabled?: boolean;
  autoResponderBody?: string | null;
};
type Person = { accountId: string; name: string; group?: string };
type Audience = {
  instructors: Person[];
  classmates: Person[];
  staff?: Person[];
};

const GROUP_LABEL: Record<string, string> = { instructors: "Faculty", classmates: "Classmates", students: "Students", staff: "Staff" };

type View =
  | "compose"
  | "inbox"
  | "outbox"
  | "drafts"
  | "junk"
  | "deleted"
  | "search"
  | "folders"
  | "lists"
  | "settings"
  | "thread";

const SIDEBAR: Array<{ id: View; label: string; compose?: boolean; kind?: string }> = [
  { id: "compose", label: "Compose", compose: true },
  { id: "inbox", label: "Inbox", kind: "inbox" },
  { id: "outbox", label: "Outbox", kind: "outbox" },
  { id: "drafts", label: "Drafts", kind: "drafts" },
  { id: "junk", label: "Junk", kind: "junk" },
  { id: "deleted", label: "Deleted", kind: "deleted" },
  { id: "search", label: "Search" },
  { id: "folders", label: "Folders" },
  { id: "lists", label: "Lists" },
  { id: "settings", label: "Settings" },
];

const KIND_BY_VIEW: Partial<Record<View, string>> = {
  inbox: "inbox",
  outbox: "outbox",
  drafts: "drafts",
  junk: "junk",
  deleted: "deleted",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric" });
}

function folderUnread(folders: Folder[], kind?: string) {
  if (!kind) return 0;
  return folders.find((f) => f.kind === kind)?.unreadCount ?? 0;
}

export function HccMailViews({
  role,
  shell,
}: {
  role: HccMailRole;
  shell: (props: { title: string; subtitle?: string; children: ReactNode }) => ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>("inbox");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [lists, setLists] = useState<Array<{ id: string; name: string; recipientCount: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [bulkAction, setBulkAction] = useState("-- Select Action --");
  const [newFolder, setNewFolder] = useState("");
  const [listName, setListName] = useState("");
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [returnView, setReturnView] = useState<View>("inbox");

  // compose
  const [messageType, setMessageType] = useState("standard");
  const [toIds, setToIds] = useState<string[]>([]);
  const [addCc, setAddCc] = useState(false);
  const [addBcc, setAddBcc] = useState(false);
  const [ccIds, setCcIds] = useState<string[]>([]);
  const [bccIds, setBccIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // search
  const [searchStart, setSearchStart] = useState("");
  const [searchEnd, setSearchEnd] = useState("");
  const [searchTitle, setSearchTitle] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchContent, setSearchContent] = useState("");
  const [searchResults, setSearchResults] = useState<ThreadRow[]>([]);

  useEffect(() => {
    const s = loadSession();
    if (s) setSession(s);
  }, []);

  const loadFolder = useCallback(async (s: Session, kind: string) => {
    const data = await api<{ folders: Folder[]; threads: ThreadRow[]; selectedFolderId: string | null }>(
      `/mail?folderKind=${encodeURIComponent(kind)}`,
      {},
      s.accessToken,
    );
    setFolders(data.folders);
    setThreads(data.threads);
    setSelected(new Set());
  }, []);

  useEffect(() => {
    if (!session) return;
    void (async () => {
      try {
        const kind = KIND_BY_VIEW[view];
        if (kind) await loadFolder(session, kind);
        if (view === "settings" || view === "compose") {
          const settingsRequest = api<{ settings: Settings }>("/mail/settings", {}, session.accessToken)
            .then((st) => setSettings(st.settings))
            .catch((err) => setError(err instanceof Error ? err.message : "Could not load mail settings"));
          const audienceRequest = api<Audience>("/mail/audience", {}, session.accessToken)
            .then(setAudience)
            .catch((err) => setError(err instanceof Error ? err.message : "Could not load recipients"));
          await Promise.allSettled([settingsRequest, audienceRequest]);
        }
        if (view === "lists") {
          const res = await api<{ items: Array<{ id: string; name: string; recipientCount: number }> }>(
            "/mail/lists",
            {},
            session.accessToken,
          );
          setLists(res.items);
        }
        if (view === "folders") {
          const data = await api<{ folders: Folder[] }>("/mail", {}, session.accessToken);
          setFolders(data.folders);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load mail");
      }
    })();
  }, [session, view, loadFolder]);

  const pageSize = 10;
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return threads.slice(start, start + pageSize);
  }, [threads, page]);
  const pageCount = Math.max(1, Math.ceil(threads.length / pageSize));

  const titleMap: Record<View, string> = {
    compose: "Compose",
    inbox: "Inbox",
    outbox: "Outbox / Sent",
    drafts: "Drafts",
    junk: "Junk",
    deleted: "Deleted",
    search: "Search",
    folders: "Folders",
    lists: "Distribution Lists",
    settings: "Settings",
    thread: thread?.subject || "Message",
  };

  function goView(next: View) {
    setView(next);
    setThread(null);
    setPage(1);
    setNotice(null);
    setError(null);
    setShowReply(false);
    setReplyText("");
  }

  async function openThread(id: string) {
    if (!session) return;
    setError(null);
    if (view !== "thread") setReturnView(view);
    try {
      const detail = await api<ThreadDetail>(`/mail/threads/${id}`, {}, session.accessToken);
      setThread(detail);
      setView("thread");
      setShowReply(false);
      setReplyText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open message");
    }
  }

  async function runBulk() {
    if (!session || selected.size === 0 || bulkAction.startsWith("--")) return;
    const map: Record<string, string> = {
      "Mark as Unread": "mark_unread",
      "Mark as Read": "mark_read",
      "Mark as Not Junk": "mark_not_junk",
      "Delete E-mails": "delete",
      "Delete Drafts": "delete_drafts",
      "Restore E-mails": "restore",
    };
    const action = map[bulkAction];
    if (!action) return;
    setBusy(true);
    try {
      await api(
        "/mail/bulk",
        {
          method: "POST",
          body: JSON.stringify({ threadIds: [...selected], action }),
        },
        session.accessToken,
      );
      setNotice("Bulk action applied");
      const kind = KIND_BY_VIEW[view];
      if (kind) await loadFolder(session, kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendCompose(asDraft: boolean) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await api(
        "/mail/compose",
        {
          method: "POST",
          body: JSON.stringify({
            toAccountIds: toIds,
            ccAccountIds: addCc ? ccIds : [],
            bccAccountIds: addBcc ? bccIds : [],
            subject,
            body,
            asDraft,
            messageType,
          }),
        },
        session.accessToken,
      );
      setNotice(asDraft ? "Draft saved" : "Message sent");
      setSubject("");
      setBody("");
      setToIds([]);
      setCcIds([]);
      setBccIds([]);
      goView(asDraft ? "drafts" : "outbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  function quoted(t: ThreadDetail) {
    const last = t.messages[t.messages.length - 1];
    if (!last) return "";
    const lines = last.text.split("\n").map((l) => `> ${l}`).join("\n");
    return `\n\n----- Original message -----\nFrom: ${last.senderName}\nSent: ${fmtDate(last.time)}\nSubject: ${t.subject}\n\n${lines}`;
  }

  function composeFrom(t: ThreadDetail, mode: "reply" | "forward") {
    const last = t.messages[t.messages.length - 1];
    const prefix = mode === "reply" ? "Re: " : "Fwd: ";
    const base = t.subject.replace(/^(re|fwd?):\s*/i, "");
    const replyTo =
      mode === "reply"
        ? [last && last.from !== "me" ? last.senderAccountId : t.to[0]?.accountId].filter((id): id is string => Boolean(id))
        : [];
    const senderName = last && last.from !== "me" ? last.senderName : t.to[0]?.name;
    if (replyTo[0] && senderName) setExtraPeople([{ accountId: replyTo[0], name: senderName }]);
    goView("compose");
    setToIds(replyTo);
    setCcIds([]);
    setBccIds([]);
    setAddCc(false);
    setAddBcc(false);
    setSubject(`${prefix}${base}`.slice(0, 200));
    setBody(quoted(t));
  }

  async function toggleFlag(id: string, flagged: boolean) {
    if (!session) return;
    try {
      await api(
        "/mail/bulk",
        { method: "POST", body: JSON.stringify({ threadIds: [id], action: flagged ? "unflag" : "flag" }) },
        session.accessToken,
      );
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, flagged: !flagged } : t)));
      setThread((prev) => (prev && prev.id === id ? { ...prev, flagged: !flagged } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update flag");
    }
  }

  async function sendReply() {
    if (!session || !thread || !replyText.trim()) return;
    setBusy(true);
    try {
      await api(
        `/mail/threads/${thread.id}/reply`,
        { method: "POST", body: JSON.stringify({ body: replyText.trim() }) },
        session.accessToken,
      );
      setNotice("Reply sent");
      setReplyText("");
      setShowReply(false);
      await openThread(thread.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setBusy(false);
    }
  }

  const [who, setWho] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [extraPeople, setExtraPeople] = useState<Person[]>([]);
  const people = useMemo(() => {
    const base = [...(audience?.staff ?? []), ...(audience?.instructors ?? []), ...(audience?.classmates ?? [])];
    const known = new Set(base.map((p) => p.accountId));
    return [...base, ...extraPeople.filter((p) => !known.has(p.accountId))];
  }, [audience, extraPeople]);
  const nameById = useMemo(() => new Map(people.map((p) => [p.accountId, p.name])), [people]);

  function pickPeople(ids: string[], setIds: (fn: (prev: string[]) => string[]) => void, prefix: string) {
    const needle = who.trim().toLowerCase();
    const shown = people.filter((p) => ids.includes(p.accountId) || !needle || p.name.toLowerCase().includes(needle));
    const groups = [...new Set(shown.map((p) => p.group ?? ""))];
    return (
      <div className="mh-hcc-mail__chips">
        {people.length === 0 ? <p className="mh-hcc-mail__hint">No recipients available yet.</p> : null}
        {people.length > 0 && shown.length === 0 ? <p className="mh-hcc-mail__hint">No one matches “{who}”.</p> : null}
        {groups.map((g) => (
          <div key={`${prefix}-${g}`} className="mh-hcc-mail__chip-group">
            {groups.length > 1 && g ? <span className="mh-hcc-mail__hint">{GROUP_LABEL[g] ?? g}</span> : null}
            {shown
              .filter((p) => (p.group ?? "") === g)
              .map((p) => {
                const on = ids.includes(p.accountId);
                return (
                  <button
                    key={`${prefix}-${p.accountId}`}
                    type="button"
                    className={`mh-hcc-mail__chip${on ? " is-on" : ""}`}
                    onClick={() => setIds((prev) => (on ? prev.filter((id) => id !== p.accountId) : [...prev, p.accountId]))}
                  >
                    {p.name}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    );
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === paged.length) setSelected(new Set());
    else setSelected(new Set(paged.map((t) => t.id)));
  }

  const bulkOptions =
    view === "drafts"
      ? ["-- Select Action --", "Delete Drafts"]
      : view === "junk"
        ? ["-- Select Action --", "Mark as Unread", "Mark as Read", "Mark as Not Junk", "Delete E-mails"]
        : view === "deleted"
          ? ["-- Select Action --", "Restore E-mails"]
          : ["-- Select Action --", "Mark as Unread", "Mark as Read", "Delete E-mails"];

  const listTitle = view === "outbox" || view === "drafts" ? "To" : view === "deleted" ? "From / To" : "From";
  const dateTitle = view === "outbox" ? "Sent" : view === "drafts" ? "Saved" : view === "deleted" ? "Date" : "Received";
  const recipientLabel =
    role === "admin" ? "Students, faculty & staff" : role === "instructor" ? "Students, faculty colleagues & staff" : "Faculty, classmates & staff";
  const customFolders = folders.filter((f) => f.kind === "custom");

  return shell({
    title: titleMap[view],
    subtitle: "My E-mail / Messages",
    children: (
      <div className="mh-hcc-mail">
        <aside className="mh-hcc-mail__nav" aria-label="Mail folders">
          <div className="mh-hcc-mail__nav-brand">
            <span className="mh-hcc-mail__nav-brand-kicker">Campus mail</span>
            <strong>My E-mail / Messages</strong>
          </div>

          {SIDEBAR.map((item) => {
            const unread = folderUnread(folders, item.kind);
            const active = view === item.id || (view === "thread" && item.id === "inbox");
            return (
              <button
                key={item.id}
                type="button"
                className={`mh-hcc-mail__nav-item${active ? " is-active" : ""}${item.compose ? " is-compose" : ""}`}
                onClick={() => goView(item.id)}
              >
                <span className="mh-hcc-mail__nav-label">{item.compose ? "+ Compose" : item.label}</span>
                {unread > 0 ? <span className="mh-hcc-mail__nav-badge">{unread}</span> : null}
              </button>
            );
          })}

          {customFolders.length > 0 ? (
            <div className="mh-hcc-mail__nav-group">
              <div className="mh-hcc-mail__nav-group-title">Custom folders</div>
              {customFolders.map((f) => (
                <div key={f.id} className="mh-hcc-mail__nav-custom">
                  <span>{f.name}</span>
                  {f.unreadCount > 0 ? <span className="mh-hcc-mail__nav-badge">{f.unreadCount}</span> : null}
                </div>
              ))}
            </div>
          ) : null}
        </aside>

        <section className="mh-hcc-mail__main">
          {error ? <p className="mh-hcc-mail__alert is-error">{error}</p> : null}
          {notice ? <p className="mh-hcc-mail__alert is-ok">{notice}</p> : null}

          {view === "compose" ? (
            <div className="mh-hcc-mail__panel mh-hcc-mail__compose" data-hide-ask-fab="">
              <header className="mh-hcc-mail__panel-head">
                <div>
                  <h2>Compose e-mail / message</h2>
                  <p>Send to {recipientLabel.toLowerCase()} with optional Cc / Bcc and draft save.</p>
                </div>
              </header>

              <fieldset className="mh-hcc-mail__type">
                <legend>Message type</legend>
                <div className="mh-hcc-mail__type-grid">
                  {[
                    ["standard", "Standard E-mail"],
                    ["individuals", "Individual(s) Lookup"],
                    ["class", "Class / Course"],
                    ["workshop", "Workshop"],
                    ["mail_merge", "Mail Merge"],
                    ["groups", "Groups / Cohorts"],
                  ].map(([value, label]) => (
                    <label key={value} className={`mh-hcc-mail__type-option${messageType === value ? " is-on" : ""}`}>
                      <input type="radio" name="msgType" checked={messageType === value} onChange={() => setMessageType(value)} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {people.length > 12 ? (
                <label className="mh-hcc-mail__field">
                  <span>Find people</span>
                  <input className="mh-teacher-field" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Type a name to filter recipients" />
                </label>
              ) : null}

              <div className="mh-hcc-mail__field">
                <span>
                  To · {recipientLabel}
                  {toIds.length ? ` (${toIds.length} selected: ${toIds.map((id) => nameById.get(id) ?? "").filter(Boolean).slice(0, 4).join(", ")}${toIds.length > 4 ? "…" : ""})` : ""}
                </span>
                {pickPeople(toIds, setToIds, "to")}
              </div>

              <div className="mh-hcc-mail__checks">
                <label>
                  <input type="checkbox" checked={addCc} onChange={(e) => setAddCc(e.target.checked)} /> Add Cc
                </label>
                <label>
                  <input type="checkbox" checked={addBcc} onChange={(e) => setAddBcc(e.target.checked)} /> Add Bcc
                </label>
              </div>

              {addCc ? (
                <div className="mh-hcc-mail__field">
                  <span>Cc</span>
                  {pickPeople(ccIds, setCcIds, "cc")}
                </div>
              ) : null}

              {addBcc ? (
                <div className="mh-hcc-mail__field">
                  <span>Bcc</span>
                  {pickPeople(bccIds, setBccIds, "bcc")}
                </div>
              ) : null}

              <label className="mh-hcc-mail__field">
                <span>Subject</span>
                <input className="mh-teacher-field" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
              </label>

              <label className="mh-hcc-mail__field">
                <span>Message body</span>
                <textarea
                  className="mh-teacher-field mh-teacher-field--tall"
                  rows={12}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message…"
                />
              </label>

              {previewing ? (
                <div className="mh-hcc-mail__attach">
                  <strong>Preview</strong>
                  <p>
                    <b>To:</b> {toIds.map((id) => nameById.get(id) ?? id).join(", ") || "—"}
                    {ccIds.length ? <><br /><b>Cc:</b> {ccIds.map((id) => nameById.get(id) ?? id).join(", ")}</> : null}
                    {bccIds.length ? <><br /><b>Bcc:</b> {bccIds.map((id) => nameById.get(id) ?? id).join(", ")}</> : null}
                    <br /><b>Subject:</b> {subject || "—"}
                  </p>
                  <p style={{ whiteSpace: "pre-wrap" }}>{body || "—"}</p>
                </div>
              ) : null}

              <div className="mh-hcc-mail__actions">
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--secondary"
                  disabled={busy || !subject.trim() || !body.trim()}
                  onClick={() => void sendCompose(true)}
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--secondary"
                  disabled={!subject.trim() && !body.trim()}
                  onClick={() => setPreviewing((v) => !v)}
                >
                  {previewing ? "Hide Preview" : "Preview"}
                </button>
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--primary"
                  disabled={busy || !subject.trim() || !body.trim() || toIds.length === 0}
                  onClick={() => void sendCompose(false)}
                >
                  Send Message
                </button>
              </div>
            </div>
          ) : null}

          {["inbox", "outbox", "drafts", "junk", "deleted"].includes(view) ? (
            <div className="mh-hcc-mail__panel mh-hcc-mail__folder">
              <div className="mh-hcc-mail__toolbar">
                <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" onClick={() => goView("compose")}>
                  + Compose
                </button>
                <div className="mh-hcc-mail__toolbar-meta">
                  <span>
                    {threads.length} message{threads.length === 1 ? "" : "s"}
                  </span>
                  <label className="mh-hcc-mail__page">
                    Page
                    <select value={page} onChange={(e) => setPage(Number(e.target.value))}>
                      {Array.from({ length: pageCount }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="mh-teacher-btn mh-teacher-btn--secondary mh-hcc-mail__icon-btn"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label="Previous page"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="mh-teacher-btn mh-teacher-btn--secondary mh-hcc-mail__icon-btn"
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label="Next page"
                  >
                    →
                  </button>
                </div>
              </div>

              {threads.length === 0 ? (
                <div className="mh-hcc-mail__empty">
                  <strong>No messages here</strong>
                  <p>
                    {view === "drafts"
                      ? "No drafts were found."
                      : view === "junk" || view === "deleted"
                        ? "No e-mails were found."
                        : "Your folder is empty. Compose a message to get started."}
                  </p>
                  {view === "inbox" ? (
                    <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" onClick={() => goView("compose")}>
                      Compose message
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="mh-hcc-mail__table" role="table">
                  <div className="mh-hcc-mail__table-head" role="row">
                    <span role="columnheader">
                      <input
                        type="checkbox"
                        checked={paged.length > 0 && selected.size === paged.length}
                        onChange={toggleAll}
                        aria-label="Select all on page"
                      />
                    </span>
                    <span role="columnheader" className="mh-hcc-mail__col-status">
                      Status
                    </span>
                    <span role="columnheader">{listTitle}</span>
                    <span role="columnheader">Subject</span>
                    <span role="columnheader">{dateTitle}</span>
                    <span role="columnheader" className="mh-hcc-mail__col-flag">
                      Flag
                    </span>
                  </div>
                  {paged.map((t) => (
                    <div
                      key={t.id}
                      role="row"
                      className={`mh-hcc-mail__row${!t.readAt ? " is-unread" : ""}${selected.has(t.id) ? " is-selected" : ""}`}
                    >
                      <span
                        role="cell"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(t.id);
                        }}
                      >
                        <input type="checkbox" checked={selected.has(t.id)} readOnly aria-label={`Select ${t.subject}`} />
                      </span>
                      <button type="button" className="mh-hcc-mail__row-main" onClick={() => void openThread(t.id)}>
                        <span className="mh-hcc-mail__status" aria-label={!t.readAt ? "Unread" : "Read"}>
                          <span className={`mh-hcc-mail__dot${!t.readAt ? " is-unread" : ""}`} />
                        </span>
                        <span className="mh-hcc-mail__from">{t.otherName || t.participants.filter(Boolean).join(", ") || "—"}</span>
                        <span className="mh-hcc-mail__subject">
                          <strong>{t.subject}</strong>
                          {t.preview ? <em>{t.preview}</em> : null}
                        </span>
                        <span className="mh-hcc-mail__date">{fmtShort(t.updatedAt)}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          className={`mh-hcc-mail__flag${t.flagged ? " is-on" : ""}`}
                          aria-label={t.flagged ? "Remove flag" : "Flag message"}
                          aria-pressed={Boolean(t.flagged)}
                          title={t.flagged ? "Flagged" : "Flag"}
                          style={{ opacity: t.flagged ? 1 : 0.3, color: t.flagged ? "#b42318" : undefined }}
                          onClick={(e) => {
                            e.stopPropagation();
                            void toggleFlag(t.id, Boolean(t.flagged));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              void toggleFlag(t.id, Boolean(t.flagged));
                            }
                          }}
                        >
                          ⚑
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mh-hcc-mail__bulk">
                <span>With checked</span>
                <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
                  {bulkOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--secondary"
                  disabled={busy || selected.size === 0 || bulkAction.startsWith("--")}
                  onClick={() => void runBulk()}
                >
                  Go
                </button>
                {selected.size > 0 ? <span className="mh-hcc-mail__bulk-count">{selected.size} selected</span> : null}
              </div>
            </div>
          ) : null}

          {view === "thread" && thread ? (
            <div className="mh-hcc-mail__panel mh-hcc-mail__thread">
              <div className="mh-hcc-mail__thread-actions">
                <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => goView(returnView)}>
                  ← Back
                </button>
                <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" onClick={() => composeFrom(thread, "reply")}>
                  Reply
                </button>
                <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => setShowReply(true)}>
                  Reply All
                </button>
                <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => composeFrom(thread, "forward")}>
                  Forward
                </button>
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--secondary"
                  aria-pressed={thread.flagged}
                  onClick={() => void toggleFlag(thread.id, thread.flagged)}
                >
                  {thread.flagged ? "⚑ Unflag" : "⚑ Flag"}
                </button>
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--secondary"
                  onClick={() => {
                    if (!session) return;
                    void api(
                      "/mail/bulk",
                      {
                        method: "POST",
                        body: JSON.stringify({ threadIds: [thread.id], action: "delete" }),
                      },
                      session.accessToken,
                    )
                      .then(() => {
                        goView("deleted");
                        setNotice("Moved to deleted");
                      })
                      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Delete failed"));
                  }}
                >
                  Delete
                </button>
              </div>

              <h2 className="mh-hcc-mail__thread-title">{thread.subject}</h2>
              <dl className="mh-hcc-mail__meta">
                <div>
                  <dt>From</dt>
                  <dd>{thread.from ? `${thread.from.name} <${thread.from.email}>` : "—"}</dd>
                </div>
                <div>
                  <dt>To</dt>
                  <dd>{thread.to.map((t) => `${t.name} <${t.email}>`).join(", ") || "—"}</dd>
                </div>
                {thread.cc.length ? (
                  <div>
                    <dt>Cc</dt>
                    <dd>{thread.cc.map((t) => `${t.name} <${t.email}>`).join(", ")}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Date</dt>
                  <dd>{thread.messages[0] ? fmtDate(thread.messages[0].time) : "—"}</dd>
                </div>
              </dl>

              <div className="mh-hcc-mail__thread-body">
                {thread.messages.map((m) => (
                  <article key={m.id} className={`mh-hcc-mail__bubble${m.from === "me" ? " is-me" : ""}`}>
                    <header>
                      <strong>{m.senderName}</strong>
                      <time>{fmtDate(m.time)}</time>
                    </header>
                    <p>{m.text}</p>
                  </article>
                ))}
              </div>

              {showReply ? (
                <div className="mh-hcc-mail__reply" data-hide-ask-fab="">
                  <p className="mh-hcc-mail__hint">
                    Reply all · goes to {thread.to.map((p) => p.name).join(", ") || "everyone on this thread"}
                    {thread.cc.length ? ` · Cc ${thread.cc.map((p) => p.name).join(", ")}` : ""}
                  </p>
                  <label className="mh-hcc-mail__field">
                    <span>Your reply</span>
                    <textarea
                      className="mh-teacher-field"
                      rows={5}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply…"
                      autoFocus
                    />
                  </label>
                  <div className="mh-hcc-mail__actions">
                    <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => setShowReply(false)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="mh-teacher-btn mh-teacher-btn--primary"
                      disabled={busy || !replyText.trim()}
                      onClick={() => void sendReply()}
                    >
                      Send reply
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mh-hcc-mail__thread-actions">
                  <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" onClick={() => composeFrom(thread, "reply")}>
                    Reply
                  </button>
                  <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => setShowReply(true)}>
                    Reply All
                  </button>
                  <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => composeFrom(thread, "forward")}>
                    Forward
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {view === "search" ? (
            <form
              className="mh-hcc-mail__panel mh-hcc-mail__search"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (!session) return;
                void (async () => {
                  setBusy(true);
                  try {
                    const res = await api<{ items: ThreadRow[] }>(
                      "/mail/search",
                      {
                        method: "POST",
                        body: JSON.stringify({
                          start: searchStart || undefined,
                          end: searchEnd || undefined,
                          title: searchTitle || undefined,
                          name: searchName || undefined,
                          content: searchContent || undefined,
                        }),
                      },
                      session.accessToken,
                    );
                    setSearchResults(res.items);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Search failed");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              <header className="mh-hcc-mail__panel-head">
                <div>
                  <h2>Search e-mails</h2>
                  <p>Find messages by date, subject, name, or body content.</p>
                </div>
              </header>
              <div className="mh-hcc-mail__search-grid">
                <label className="mh-hcc-mail__field">
                  <span>Date / time start</span>
                  <input className="mh-teacher-field" type="datetime-local" value={searchStart} onChange={(e) => setSearchStart(e.target.value)} />
                </label>
                <label className="mh-hcc-mail__field">
                  <span>Date / time end</span>
                  <input className="mh-teacher-field" type="datetime-local" value={searchEnd} onChange={(e) => setSearchEnd(e.target.value)} />
                </label>
                <label className="mh-hcc-mail__field">
                  <span>Title search</span>
                  <input className="mh-teacher-field" placeholder="Subject" value={searchTitle} onChange={(e) => setSearchTitle(e.target.value)} />
                </label>
                <label className="mh-hcc-mail__field">
                  <span>Name search</span>
                  <input
                    className="mh-teacher-field"
                    placeholder="To, From or E-mail Address"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                  />
                </label>
                <label className="mh-hcc-mail__field mh-hcc-mail__field--span">
                  <span>Content search</span>
                  <input
                    className="mh-teacher-field"
                    placeholder="Message / Body Content"
                    value={searchContent}
                    onChange={(e) => setSearchContent(e.target.value)}
                  />
                </label>
              </div>
              <button type="submit" className="mh-teacher-btn mh-teacher-btn--primary" disabled={busy}>
                Search
              </button>
              <ul className="mh-hcc-mail__search-results">
                {searchResults.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => void openThread(r.id)}>
                      <strong>{r.subject}</strong>
                      <span>{r.preview}</span>
                      <em>{fmtShort(r.updatedAt)}</em>
                    </button>
                  </li>
                ))}
              </ul>
            </form>
          ) : null}

          {view === "folders" ? (
            <div className="mh-hcc-mail__panel mh-hcc-mail__folders-page">
              <header className="mh-hcc-mail__panel-head">
                <div>
                  <h2>Folders</h2>
                  <p>Create custom folders to organize campus mail.</p>
                </div>
              </header>
              <section className="mh-hcc-mail__create-card">
                <h3>Create new folder</h3>
                <label className="mh-hcc-mail__field">
                  <span>Folder name</span>
                  <input className="mh-teacher-field" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
                </label>
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--primary"
                  disabled={!newFolder.trim() || !session}
                  onClick={() => {
                    if (!session) return;
                    void api("/mail/folders", { method: "POST", body: JSON.stringify({ name: newFolder.trim() }) }, session.accessToken).then(
                      async () => {
                        setNewFolder("");
                        setNotice("Folder saved");
                        const data = await api<{ folders: Folder[] }>("/mail", {}, session.accessToken);
                        setFolders(data.folders);
                      },
                    );
                  }}
                >
                  Save folder
                </button>
              </section>
              <table className="mh-hcc-mail__simple-table">
                <thead>
                  <tr>
                    <th>Folder name</th>
                    <th>Unread</th>
                  </tr>
                </thead>
                <tbody>
                  {customFolders.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="mh-hcc-mail__hint">
                        No folders were found.
                      </td>
                    </tr>
                  ) : (
                    customFolders.map((f) => (
                      <tr key={f.id}>
                        <td>{f.name}</td>
                        <td>{f.unreadCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {view === "lists" ? (
            <div className="mh-hcc-mail__panel mh-hcc-mail__lists-page">
              <header className="mh-hcc-mail__panel-head">
                <div>
                  <h2>Distribution lists</h2>
                  <p>Create reusable recipient lists for class or cohort mail.</p>
                </div>
              </header>
              <section className="mh-hcc-mail__create-card">
                <h3>Create distribution list</h3>
                <label className="mh-hcc-mail__field">
                  <span>List name</span>
                  <input className="mh-teacher-field" value={listName} onChange={(e) => setListName(e.target.value)} />
                </label>
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--primary"
                  disabled={!listName.trim() || !session}
                  onClick={() => {
                    if (!session) return;
                    void api("/mail/lists", { method: "POST", body: JSON.stringify({ name: listName.trim() }) }, session.accessToken).then(
                      async () => {
                        setListName("");
                        setNotice("List created");
                        const res = await api<{ items: typeof lists }>("/mail/lists", {}, session.accessToken);
                        setLists(res.items);
                      },
                    );
                  }}
                >
                  Create list
                </button>
              </section>
              <table className="mh-hcc-mail__simple-table">
                <thead>
                  <tr>
                    <th>Distribution list</th>
                    <th>Recipients</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="mh-hcc-mail__hint">
                        No distribution lists were found.
                      </td>
                    </tr>
                  ) : (
                    lists.map((l) => (
                      <tr key={l.id}>
                        <td>{l.name}</td>
                        <td>{l.recipientCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          {view === "settings" && settings ? (
            <form
              className="mh-hcc-mail__panel mh-hcc-mail__settings"
              onSubmit={(e) => {
                e.preventDefault();
                if (!session) return;
                void api("/mail/settings", { method: "PATCH", body: JSON.stringify(settings) }, session.accessToken)
                  .then(() => setNotice("Settings saved"))
                  .catch((err) => setError(err instanceof Error ? err.message : "Save failed"));
              }}
            >
              <header className="mh-hcc-mail__panel-head">
                <div>
                  <h2>Mail settings</h2>
                  <p>Forwarding, signature, auto-responder, and notification preferences.</p>
                </div>
              </header>

              <h3 className="mh-hcc-mail__section-title">E-mail settings</h3>
              <div className="mh-hcc-mail__settings-grid">
                <label className="mh-hcc-mail__field">
                  <span>E-mail address</span>
                  <input className="mh-teacher-field" value={settings.emailAddress ?? ""} readOnly />
                </label>
                <label className="mh-hcc-mail__field">
                  <span>Forward e-mails</span>
                  <select
                    className="mh-teacher-field"
                    value={settings.forwardingEnabled ? "On" : "Off"}
                    onChange={(e) => setSettings({ ...settings, forwardingEnabled: e.target.value === "On" })}
                  >
                    <option>Off</option>
                    <option>On</option>
                  </select>
                </label>
                <label className="mh-hcc-mail__field">
                  <span>Text forwarding (SMS)</span>
                  <select
                    className="mh-teacher-field"
                    value={settings.smsForwardingEnabled ? "On" : "Off"}
                    onChange={(e) => setSettings({ ...settings, smsForwardingEnabled: e.target.value === "On" })}
                  >
                    <option>Off</option>
                    <option>On</option>
                  </select>
                </label>
              </div>

              <h3 className="mh-hcc-mail__section-title">Signature</h3>
              <label className="mh-hcc-mail__field">
                <span>Your e-mail signature</span>
                <textarea
                  className="mh-teacher-field"
                  rows={5}
                  value={settings.signature ?? ""}
                  onChange={(e) => setSettings({ ...settings, signature: e.target.value || null })}
                />
              </label>

              <h3 className="mh-hcc-mail__section-title">Auto-responder</h3>
              <label className="mh-hcc-mail__field">
                <span>Auto-response status</span>
                <select
                  className="mh-teacher-field"
                  value={settings.autoResponderEnabled ? "Enabled" : "Disabled"}
                  onChange={(e) => setSettings({ ...settings, autoResponderEnabled: e.target.value === "Enabled" })}
                >
                  <option>Disabled</option>
                  <option>Enabled</option>
                </select>
              </label>

              <h3 className="mh-hcc-mail__section-title">Notifications</h3>
              <div className="mh-hcc-mail__settings-grid">
                <label className="mh-hcc-mail__field">
                  <span>Notification pop-up</span>
                  <select
                    className="mh-teacher-field"
                    value={settings.popupNotifications ? "Enabled" : "Disabled"}
                    onChange={(e) => setSettings({ ...settings, popupNotifications: e.target.value === "Enabled" })}
                  >
                    <option>Enabled</option>
                    <option>Disabled</option>
                  </select>
                </label>
                <label className="mh-hcc-mail__field">
                  <span>Play notification sound</span>
                  <select
                    className="mh-teacher-field"
                    value={settings.notificationSound ? "Yes" : "No"}
                    onChange={(e) => setSettings({ ...settings, notificationSound: e.target.value === "Yes" })}
                  >
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </label>
              </div>

              <div className="mh-hcc-mail__actions">
                <button type="submit" className="mh-teacher-btn mh-teacher-btn--primary">
                  Save settings
                </button>
              </div>
            </form>
          ) : null}
        </section>
      </div>
    ),
  });
}
