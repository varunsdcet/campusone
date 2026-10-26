"use client";

import {
  Suspense,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  CoachAnswer,
  CoachHistoryResponse,
  CoachSource,
  CoachSuggestedAction,
  DegreePlanAnalysis,
} from "@myheritage/contracts";
import { Banner, Button, LogoMark, StatusPill } from "@myheritage/ui";
import { api, loadSession } from "@/lib/api";
import type { ShellRole } from "@/lib/nav";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { SuperFrame } from "@/components/superadmin/shared";
import { StudentSisShell } from "@/components/StudentSisShell";
import { TeacherSisShell } from "@/components/TeacherSisShell";

const suggestions: Record<ShellRole, string[]> = {
  student: [
    "Can I graduate next summer?",
    "What happens if I drop MATH 210?",
    "I don't understand normalization — explain it.",
    "Am I at risk academically?",
    "How do I request a transcript?",
  ],
  instructor: [
    "Give me a morning teaching summary.",
    "What classes am I teaching today?",
    "Which assignments need grading?",
    "Who might need help in this class?",
    "Show students with attendance below 80% and missing work.",
    "Validate my gradebook and list missing marks.",
  ],
  admin: [
    "How many students are currently enrolled?",
    "Show enrollment by program.",
    "Which courses have less than 40% seat utilization?",
  ],
  applicant: [
    "What documents are missing?",
    "What is my application status?",
    "What do I need to apply?",
  ],
  employer: [
    "What placement work needs attention?",
    "Are any hours waiting for review?",
    "What employer records are available to me?",
  ],
};

const instructorOpsBlocks = [
  {
    title: "Today",
    body: "Classes, rooms, times, and attendance status",
    prompt: "Give me a morning teaching summary.",
  },
  {
    title: "Action Required",
    body: "Ungraded work, unread messages, pending grades",
    prompt: "Which assignments need grading?",
  },
  {
    title: "Student Attention",
    body: "Low attendance, missing work, declining performance",
    prompt: "Who might need help in this class?",
  },
  {
    title: "My Courses",
    body: "Assigned sections and enrollment counts",
    prompt: "Show all courses assigned to me.",
  },
  {
    title: "Quick Actions",
    body: "Attendance, gradebook, messages, badges",
    href: "/instructor/attendance",
  },
  {
    title: "Ask AI",
    body: "Natural-language teaching operations",
    prompt: "What should I focus on as an instructor today?",
  },
] as const;

/** `crypto.randomUUID` is missing on non-secure origins (plain HTTP VPS). */
function clientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function capabilityForPath(role: ShellRole, contextPath: string): string | undefined {
  if (contextPath.startsWith("/student/study")) return "study_coach";
  if (contextPath.startsWith("/student/degree")) return "student_advisor";
  if (contextPath.startsWith("/student/success")) return "student_success";
  if (contextPath.startsWith("/student/career")) return "career_assistant";
  if (contextPath.startsWith("/admin/ai")) return "admin_ask_data";
  if (role === "instructor" && contextPath.startsWith("/instructor")) return "faculty_assistant";
  if (contextPath.startsWith("/applicant")) return "admissions_assistant";
  return undefined;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt?: string;
  sources?: CoachSource[];
  suggestedActions?: CoachSuggestedAction[];
  analysis?: DegreePlanAnalysis;
  capability?: CoachAnswer["capability"];
};

function messagesFromHistory(items: CoachHistoryResponse["items"]): ChatMessage[] {
  return [...items].reverse().flatMap((item) => [
    {
      id: `${item.interactionId}-q`,
      role: "user" as const,
      text: item.question,
      createdAt: item.createdAt,
    },
    {
      id: item.interactionId,
      role: "assistant" as const,
      text: item.answer,
      createdAt: item.createdAt,
      sources: item.sources,
      suggestedActions: item.suggestedActions,
    },
  ]);
}

function formatCoachWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CampusCoachBody({ role, contextPath }: { role: ShellRole; contextPath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [attachNote, setAttachNote] = useState<string | null>(null);
  const [attachContent, setAttachContent] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bootstrappedQuery = useRef(false);
  const sendingRef = useRef(false);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      setHistoryLoading(false);
      return;
    }
    api<CoachHistoryResponse>("/ai/history", {}, session.accessToken)
      .then((payload) => setMessages(messagesFromHistory(payload.items)))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load Ask CampusOne history"))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    if (historyLoading || bootstrappedQuery.current) return;
    const q = searchParams.get("q")?.trim();
    if (q) {
      bootstrappedQuery.current = true;
      void send(q);
    }
  }, [historyLoading, searchParams]);

  useEffect(() => {
    const node = threadRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, loading, historyLoading]);

  useEffect(() => {
    if (historyLoading) return;
    inputRef.current?.focus();
  }, [historyLoading]);

  function resizeDraft() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function readDraft(question?: string) {
    return (question ?? inputRef.current?.value ?? draft).trim();
  }

  async function send(question?: string) {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    const trimmed = readDraft(question);
    if (!trimmed || sendingRef.current) return;
    const questionWithAttachment = attachNote && attachContent
      ? `${trimmed}\n\nAttached file: ${attachNote}\n${attachContent}`.slice(0, 2000)
      : trimmed;
    sendingRef.current = true;

    const pendingId = `local-${clientId()}`;
    setDraft("");
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.style.height = "auto";
    }
    setError(null);
    setLoading(true);
    setMessages((current) => [
      ...current,
      { id: pendingId, role: "user", text: trimmed, createdAt: new Date().toISOString() },
    ]);
    setAttachNote(null);
    setAttachContent(null);

    try {
      const response = await api<CoachAnswer>(
        "/ai/ask",
        {
          method: "POST",
          headers: { "idempotency-key": clientId() },
          body: JSON.stringify({
            question: questionWithAttachment,
            contextPath,
            capability: capabilityForPath(role, contextPath),
          }),
        },
        session.accessToken,
      );
      setMessages((current) => [
        ...current,
        {
          id: response.interactionId,
          role: "assistant",
          text: response.answer,
          createdAt: response.createdAt || new Date().toISOString(),
          sources: response.sources,
          suggestedActions: response.suggestedActions,
          analysis: response.analysis,
          capability: response.capability,
        },
      ]);
    } catch (reason) {
      const offline =
        (typeof navigator !== "undefined" && navigator.onLine === false) ||
        reason instanceof TypeError ||
        (reason instanceof Error && /failed to fetch|networkerror|load failed/i.test(reason.message));
      setError(
        offline
          ? "You appear to be offline. Reconnect to ask Ask CampusOne."
          : reason instanceof Error
            ? reason.message
            : "Ask CampusOne could not answer this question",
      );
      setDraft((current) => current || trimmed);
    } finally {
      sendingRef.current = false;
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    void send();
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      void send(event.currentTarget.value);
    }
  }

  const empty = !historyLoading && messages.length === 0 && !loading;

  const chat = (
      <div className="mh-ask-chat-page">
      <section className="mh-ask-chat" aria-label="Ask CampusOne chatbot">
        <header className="mh-ask-chat__head">
          <LogoMark size={32} />
          <div className="mh-ask-chat__head-copy">
            <h1>
              {contextPath.includes("/study")
                ? "Study with AI"
                : role === "instructor"
                  ? "Ask CampusOne · Teaching Ops"
                  : "Ask CampusOne"}
            </h1>
            <span>
              {contextPath.includes("/study")
                ? "Course-grounded tutoring with academic-integrity gates"
                : role === "instructor"
                  ? "Plan, run class, assess, support students, and close the term — grounded in your sections"
                  : "Grounded answers from your campus records"}
            </span>
          </div>
          <StatusPill tone="ai">{role === "instructor" ? "Ops · confirm writes" : "Read-only"}</StatusPill>
        </header>

        <div ref={threadRef} className="mh-ask-chat__thread" role="log" aria-live="polite" aria-busy={loading || historyLoading}>
          {historyLoading ? (
            <p className="mh-ask-chat__status">Loading conversation…</p>
          ) : null}

          {empty ? (
            <div className="mh-ask-chat__welcome">
              <LogoMark size={44} />
              <h2>{role === "instructor" ? "Teaching Operations Assistant" : "Ask CampusOne"}</h2>
              <p>
                {role === "instructor"
                  ? "Prepare classes, manage students, attendance and marks, create learning material, communicate, spot struggling students, and finish course admin — in natural language. Writes stay previews until you confirm on the live screen."
                  : "Ask about admissions, courses, grades, fees, practicum, and policies. Replies stay in this chat."}
              </p>
              {role === "instructor" ? (
                <div className="mh-ask-ops-grid" aria-label="Teaching operations home">
                  {instructorOpsBlocks.map((block) => (
                    <button
                      key={block.title}
                      type="button"
                      className="mh-ask-ops-card"
                      disabled={loading}
                      onClick={() => {
                        if ("href" in block && block.href) {
                          router.push(block.href);
                          return;
                        }
                        if ("prompt" in block && block.prompt) void send(block.prompt);
                      }}
                    >
                      <strong>{block.title}</strong>
                      <span>{block.body}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mh-ask-chat__chips">
                {suggestions[role].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="mh-ask-chat__chip"
                    disabled={loading}
                    onClick={() => void send(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <article
              key={message.id}
              className={`mh-ask-chat__row is-${message.role}`}
              aria-label={message.role === "user" ? "You" : "Ask CampusOne"}
            >
              <div className="mh-ask-chat__bubble">
                {message.createdAt ? (
                  <time className="mh-ask-chat__when" dateTime={message.createdAt}>
                    {formatCoachWhen(message.createdAt)}
                  </time>
                ) : null}
                {message.role === "assistant" ? (
                  <MarkdownMessage text={message.text} />
                ) : (
                  <div className="mh-ask-chat__plain">{message.text}</div>
                )}
                {message.role === "assistant" && message.analysis ? (
                  <div className="mh-ask-chat__meta">
                    <strong className="mh-ask-chat__meta-label">Degree snapshot</strong>
                    <p style={{ margin: "0.35rem 0 0", fontSize: 13, color: "var(--mh-text-muted)" }}>
                      {message.analysis.programName} · {message.analysis.completedCredits}/
                      {message.analysis.requiredCredits} credits · projected{" "}
                      {message.analysis.projectedCompletionTerm ?? "not determined"}
                    </p>
                  </div>
                ) : null}
                {message.role === "assistant" && message.sources?.length ? (
                  <div className="mh-ask-chat__meta">
                    <strong className="mh-ask-chat__meta-label">Sources</strong>
                    <div className="mh-ask-chat__chips">
                      {message.sources.map((source) => (
                        <button
                          key={source.id}
                          type="button"
                          className="mh-ask-chat__chip"
                          onClick={() => router.push(source.uri)}
                        >
                          {source.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {message.role === "assistant" && message.suggestedActions?.length ? (
                  <div className="mh-ask-chat__meta">
                    <strong className="mh-ask-chat__meta-label">Next steps</strong>
                    <div className="mh-ask-chat__chips">
                      {message.suggestedActions.map((action) => (
                        <button
                          key={action.href + action.label}
                          type="button"
                          className="mh-ask-chat__chip is-primary"
                          onClick={() => router.push(action.href)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          ))}

          {loading ? (
            <article className="mh-ask-chat__row is-assistant" aria-label="Ask CampusOne is typing">
              <div className="mh-ask-chat__bubble mh-ask-chat__typing">
                <span className="mh-ask-chat__dot" />
                <span className="mh-ask-chat__dot" />
                <span className="mh-ask-chat__dot" />
              </div>
            </article>
          ) : null}
        </div>

        <form className="mh-ask-chat__composer" onSubmit={onSubmit}>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {attachNote ? (
            <p className="mh-ask-chat__attach-note">
              Attachment ready: <strong>{attachNote}</strong>{" "}
              <button type="button" className="mh-ask-chat__attach-clear" onClick={() => { setAttachNote(null); setAttachContent(null); }}>
                Remove
              </button>
            </p>
          ) : null}
          <div className="mh-ask-chat__composer-row">
            <input
              ref={fileRef}
              type="file"
              className="mh-ask-chat__file"
              aria-label="Add attachment"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) { setAttachNote(null); setAttachContent(null); return; }
                if (file.size > 256 * 1024 || !/\.(txt|md|csv)$/i.test(file.name)) {
                  setError("Coach attachments must be a TXT, Markdown, or CSV file no larger than 256 KB.");
                  setAttachNote(null); setAttachContent(null); e.target.value = ""; return;
                }
                setError(null);
                setAttachNote(file.name);
                setAttachContent((await file.text()).slice(0, 1200));
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="mh-ask-chat__attach"
              aria-label="Add attachment or link"
              title="Add attachment or link"
              disabled={loading}
              onClick={() => fileRef.current?.click()}
            >
              +
            </button>
            <label className="mh-ask-chat__composer-field">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  resizeDraft();
                }}
                onKeyDown={onDraftKeyDown}
                minLength={1}
                maxLength={2000}
                rows={1}
                placeholder="Message Ask CampusOne…"
                aria-label="Message Ask CampusOne"
                disabled={loading}
                autoFocus
                className="mh-ask-chat__input"
              />
            </label>
            <Button className="mh-ask-chat__send" type="submit" variant="ai" disabled={loading || !draft.trim()}>
              {loading ? "Sending…" : "Send"}
            </Button>
          </div>
          <p className="mh-ask-chat__hint">
            Enter to send, Shift+Enter for a new line. Ask CampusOne answers questions but will not change a grade,
            application, enrolment, payment, or placement.
          </p>
        </form>
      </section>
      </div>
  );

  if (role === "student") {
    return (
      <StudentSisShell title="Ask CampusOne" subtitle="Grounded campus assistant" activeHref="/student/ask">
        {chat}
      </StudentSisShell>
    );
  }

  if (role === "instructor") {
    return (
      <TeacherSisShell title="Ask CampusOne" subtitle="Grounded campus assistant" activeHref="/instructor/ask">
        {chat}
      </TeacherSisShell>
    );
  }

  if (role === "admin") {
    return (
      <SuperFrame title="Ask CampusOne" breadcrumbs={["Home", "Ask CampusOne"]} activeHref="/admin/ai/ask">
        {chat}
      </SuperFrame>
    );
  }

  return (
    <ScreenScaffold
      role={role}
      active="Ask CampusOne"
      title="Ask CampusOne"
      subtitle="Campus AI assistant. Answers use only records available to your account."
      breadcrumb={[role[0]!.toUpperCase() + role.slice(1), "Ask CampusOne"]}
      hideChromeHeader
    >
      {chat}
    </ScreenScaffold>
  );
}

export function CampusCoach(props: { role: ShellRole; contextPath: string }) {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading Ask CampusOne…</p>}>
      <CampusCoachBody {...props} />
    </Suspense>
  );
}
