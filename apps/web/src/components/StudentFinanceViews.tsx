"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@myheritage/ui";
import { API_URL, api, loadSession } from "@/lib/api";
import { StudentFrame } from "@/components/StudentSisShell";
import { useEffect, useCallback } from "react";
import { ApiError, type Session } from "@/lib/api";

type LoadState = "loading" | "ready" | "offline" | "forbidden" | "error";

type FinancePayload = {
  summary: {
    balance: { amountCents: number };
    pastDue: { amountCents: number };
    nextDueAt: string | null;
    paymentExecutionEnabled: boolean;
  };
  entries: Array<{
    id: string;
    label: string;
    amountCad: number;
    kind: "charge" | "credit" | "payment";
    status: string;
    source?: string | null;
    postedAt: string;
  }>;
  financialTerms: Array<{ id: string; code: string; name: string; startsOn: string; endsOn: string }>;
  selectedFinancialTermId?: string | null;
  statement: {
    termCode: string;
    termName: string;
    charges: Array<{ id: string; label: string; amountCad: number }>;
    totalChargesCad: number;
    gstRatePercent: number;
    gstCad: number;
    pstRatePercent: number;
    pstCad: number;
    totalPaymentsCad: number;
    balanceCad: number;
  } | null;
  history: Array<{
    key: string;
    label: string;
    events: Array<{
      id: string;
      date: string;
      kind: "payment" | "accounts_receivable" | "credit";
      title: string;
      amountCad: number;
      source?: string | null;
      receiptAvailable: boolean;
      lines: Array<{ id: string; label: string; amountCad: number }>;
    }>;
  }>;
};

function money(n: number) {
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function owed(n: number) {
  return `(${money(n)})`;
}

function useFinance(termId: string | null) {
  const router = useRouter();
  const path = termId ? `/student/finance?financialTermId=${encodeURIComponent(termId)}` : "/student/finance";
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<FinancePayload | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (active: Session) => {
      setState("loading");
      setError(null);
      try {
        setData(await api<FinancePayload>(path, {}, active.accessToken));
        setState("ready");
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          router.replace("/login");
          return;
        }
        if (caught instanceof ApiError && caught.status === 403) {
          setState("forbidden");
          return;
        }
        if ((typeof navigator !== "undefined" && !navigator.onLine) || caught instanceof TypeError) {
          setState("offline");
          return;
        }
        setError(caught instanceof Error ? caught.message : "Failed to load finance");
        setState("error");
      }
    },
    [path, router],
  );

  useEffect(() => {
    const active = loadSession();
    if (!active) {
      router.replace("/login");
      return;
    }
    setSession(active);
    void load(active);
  }, [load, router]);

  return { session, data, state, error, refresh: () => session && void load(session) };
}

export function StudentFeesView() {
  const router = useRouter();
  const search = useSearchParams();
  const [termId, setTermId] = useState<string | null>(search.get("term"));
  const resource = useFinance(termId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const terms = resource.data?.financialTerms ?? [];
  const selected = termId || resource.data?.selectedFinancialTermId || null;
  const statement = resource.data?.statement;

  useEffect(() => {
    if (!termId && resource.data?.selectedFinancialTermId) {
      setTermId(resource.data.selectedFinancialTermId);
    }
  }, [termId, resource.data?.selectedFinancialTermId]);

  async function downloadStatement() {
    const session = loadSession();
    if (!session) return;
    setBusy(true);
    setNotice(null);
    try {
      const qs = selected ? `?financialTermId=${encodeURIComponent(selected)}` : "";
      const data = await api<{ statementText: string; studentNumber?: string }>(
        `/student/finance/statement${qs}`,
        {},
        session.accessToken,
      );
      const blob = new Blob([data.statementText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `financial-statement-${data.studentNumber || "student"}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("Statement downloaded.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  const paidSession = search.get("session_id");
  const canceled = search.get("canceled") === "1";
  useEffect(() => {
    if (canceled) setNotice("Payment cancelled. You were not charged.");
    if (!paidSession) return;
    const session = loadSession();
    if (!session) return;
    setBusy(true);
    api<{ amountCad: number; number: number }>(
      "/student/finance/checkout/confirm",
      { method: "POST", body: JSON.stringify({ sessionId: paidSession }) },
      session.accessToken,
    )
      .then((r) => {
        setNotice(`Payment of ${money(r.amountCad)} received (transaction #${r.number}). Thank you!`);
        resource.refresh();
      })
      .catch((err) => setNotice(err instanceof Error ? err.message : "We could not confirm your payment."))
      .finally(() => {
        setBusy(false);
        router.replace("/student/fees");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidSession, canceled]);

  async function payBalance() {
    const session = loadSession();
    if (!session) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await api<{ url: string }>("/student/finance/checkout", { method: "POST", body: JSON.stringify({}) }, session.accessToken);
      window.location.assign(r.url);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not start payment");
      setBusy(false);
    }
  }

  const accountOwing = (resource.data?.summary.balance.amountCents ?? 0) / 100;

  function onTermChange(next: string) {
    setTermId(next || null);
    router.replace(next ? `/student/fees?term=${encodeURIComponent(next)}` : "/student/fees");
  }

  return (
    <StudentFrame role="student" title="" activeHref="/student/fees">
      <div className="mh-hcc-page mh-sis-finance" data-stu="STU-23">
        <p className="mh-hcc-profile__crumb">
          Home <span>›</span> Financial Statements
        </p>
        <h1 className="mh-sis-finance__title">FINANCIAL STATEMENTS</h1>

        {resource.state !== "ready" ? (
          <div className="mh-hcc-panel">
            <EmptyState
              title={resource.state === "loading" ? "Loading" : "Unavailable"}
              body={resource.error || "Fetching your financial statement…"}
            />
            {resource.state === "error" || resource.state === "offline" ? (
              <button type="button" className="mh-hcc-btn" onClick={resource.refresh}>
                Try again
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mh-sis-finance__term">
              <label>
                <span>TERM:</span>
                <select value={selected ?? ""} onChange={(e) => onTermChange(e.target.value)}>
                  <option value="">All terms</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mh-sis-finance__banner">
              FINANCIAL STATEMENT: {(statement?.termCode || "—").toUpperCase()}
            </div>

            <div className="mh-sis-finance__current">
              <h2>CURRENT STATEMENT: {(statement?.termCode || "—").toUpperCase()}</h2>
              <button type="button" className="mh-sis-finance__download" onClick={() => void downloadStatement()} disabled={busy}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="#1d4ed8" strokeWidth="1.6" />
                  <path d="M14 2v6h6M8 13h8M8 17h5" stroke="#1d4ed8" strokeWidth="1.6" />
                </svg>
                {busy ? "Preparing…" : "Download Statement"}
              </button>
            </div>
            {notice ? <p className="mh-teacher-muted">{notice}</p> : null}
            {resource.data?.summary.paymentExecutionEnabled && accountOwing >= 1 ? (
              <div className="mh-sis-finance__balance">
                <span>Account balance owing: {owed(accountOwing)}</span>
                <button type="button" className="mh-hcc-btn" onClick={() => void payBalance()} disabled={busy}>
                  {busy ? "Please wait…" : `Pay ${money(accountOwing)} by card`}
                </button>
              </div>
            ) : null}

            {!statement || (statement.charges.length === 0 && statement.totalPaymentsCad === 0) ? (
              <EmptyState title="No fees posted" body="New fees & charges will appear when finance posts your term statement." />
            ) : (
              <>
                <h3 className="mh-sis-finance__section">NEW FEES &amp; CHARGES</h3>
                <ul className="mh-sis-finance__charges">
                  {statement.charges.map((c) => (
                    <li key={c.id}>
                      <span>{c.label}</span>
                      <span className="mh-sis-finance__dots" aria-hidden />
                      <strong>{money(c.amountCad)}</strong>
                    </li>
                  ))}
                </ul>

                <div className="mh-sis-finance__totals">
                  <div>
                    <span>Total New Fees &amp; Charges:</span>
                    <strong className="is-owed">{owed(statement.totalChargesCad)}</strong>
                  </div>
                  <div>
                    <span>GST {statement.gstRatePercent}%:</span>
                    <strong className="is-owed">{owed(statement.gstCad)}</strong>
                  </div>
                  <div>
                    <span>PST {statement.pstRatePercent}%:</span>
                    <strong className="is-owed">{owed(statement.pstCad)}</strong>
                  </div>
                  <div>
                    <span>Total Payments:</span>
                    <strong>{money(statement.totalPaymentsCad)}</strong>
                  </div>
                </div>

                <div className="mh-sis-finance__balance">
                  <span>Statement Balance:</span>
                  <strong className="is-owed">{owed(statement.balanceCad)}</strong>
                </div>
              </>
            )}

            <div className="mh-sis-finance__history-link">
              <button type="button" onClick={() => router.push("/student/fees/transactions")}>
                View Transaction History »
              </button>
            </div>
          </>
        )}
      </div>
    </StudentFrame>
  );
}

export function StudentTransactionHistoryView() {
  const router = useRouter();
  const resource = useFinance(null);
  const [receiptBusy, setReceiptBusy] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const months = useMemo(() => resource.data?.history ?? [], [resource.data]);

  async function downloadReceipt(entryId: string) {
    if (!resource.session) return;
    setReceiptBusy(entryId);
    setReceiptError(null);
    try {
      const response = await fetch(`${API_URL}/student/finance/receipts/${encodeURIComponent(entryId)}`, {
        headers: { authorization: `Bearer ${resource.session.accessToken}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message || "Receipt download failed");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `receipt-${entryId}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : "Receipt download failed");
    } finally {
      setReceiptBusy(null);
    }
  }

  return (
    <StudentFrame role="student" title="" activeHref="/student/fees">
      <div className="mh-hcc-page mh-sis-finance" data-stu="STU-24">
        <p className="mh-hcc-profile__crumb">
          Home <span>›</span> Financial Statements <span>›</span> Financial Transaction History
        </p>
        <h1 className="mh-sis-finance__title">TRANSACTION HISTORY</h1>
        <button type="button" className="mh-sis-finance__back" onClick={() => router.push("/student/fees")}>
          « Back to Statements
        </button>
        {receiptError ? <p style={{ color: "var(--mh-danger)" }}>{receiptError}</p> : null}

        {resource.state !== "ready" ? (
          <div className="mh-hcc-panel">
            <EmptyState title={resource.state === "loading" ? "Loading" : "Unavailable"} body={resource.error || "Fetching transactions…"} />
          </div>
        ) : months.length === 0 ? (
          <EmptyState title="No transactions" body="Payments and charges will appear here once posted." />
        ) : (
          <div className="mh-sis-finance__history">
            {months.map((month) => (
              <section key={month.key}>
                <h2>{month.label}</h2>
                <ul>
                  {month.events.map((event) => (
                    <li key={event.id} className="mh-sis-finance__event">
                      <div className="mh-sis-finance__event-date">
                        <strong>
                          {new Date(event.date).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            timeZone: "UTC",
                          })}
                        </strong>
                        {event.receiptAvailable ? (
                          <button type="button" className="mh-sis-finance__receipt" disabled={receiptBusy === event.id} onClick={() => void downloadReceipt(event.id)}>
                            {receiptBusy === event.id ? "Opening…" : "Receipt"}
                          </button>
                        ) : null}
                      </div>
                      <div className="mh-sis-finance__event-body">
                        <p>
                          <strong>{event.title}</strong>
                        </p>
                        {event.source ? <p className="mh-sis-finance__source">{event.source}</p> : null}
                        {event.lines.length > 0 ? (
                          <ul className="mh-sis-finance__lines">
                            {event.lines.map((line) => (
                              <li key={line.id}>
                                - {line.label}: {money(line.amountCad)}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </StudentFrame>
  );
}
