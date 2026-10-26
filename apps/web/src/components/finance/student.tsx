"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  FIN,
  Field,
  FinFrame,
  FinTable,
  LinkBtn,
  Money,
  Select,
  StudentPicker,
  Sub,
  downloadPdf,
  errMsg,
  fin,
  fmtDay,
  json,
  money,
  today,
  useFinMeta,
  useFlash,
  type FinMeta,
  type ListCtx,
} from "./kit";
import {
  AddFeeModal,
  AuditDetailModal,
  AwardModal,
  CollectionsModal,
  ConfirmModal,
  DisbursementModal,
  DocumentsPanel,
  InvoiceEditor,
  ManageAgentModal,
  PlanModal,
  ReceiptModal,
  RefundModal,
  type AwardRow,
  type CreditRow,
  type FeeRow,
  type InvoiceRow,
  type PlanRow,
  type TxRow,
} from "./forms";
import { awardActions, awardColumns, creditActions, feeActions, invoiceActions, invoiceColumns, planActions, planColumns } from "./records";

const TABS = [
  { id: "overview", label: "Financial Overview" },
  { id: "transactions", label: "Financial Transactions" },
  { id: "invoices", label: "Manage Invoices" },
  { id: "disbursements", label: "Disbursements & Credits" },
  { id: "promotions", label: "Promotions & Awards" },
  { id: "plans", label: "Payment Plans & Collections" },
  { id: "documents", label: "Documents & Tax Forms" },
  { id: "audit", label: "Audit Trail" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type Header = { id: string; name: string; preferred: string; initials: string; applicationNumber: string; status: string; campus: string; program: string; cgpa: number | null; email: string; rateCategory: string };
type H = { open: (n: ReactNode) => void; close: () => void; done: (m: string) => void; refresh: () => void; ok: (m: string) => void; fail: (m: string) => void; meta: FinMeta; edit: boolean; sid: string; header: Header; rev: number };

function studentIdFrom(sp: URLSearchParams | null) {
  const ctx = sp?.get("ctx") ?? "";
  const m = /^student:(.+)$/.exec(ctx);
  return m?.[1] ?? sp?.get("id") ?? "";
}

export function StudentFinance() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const sid = studentIdFrom(sp);
  const tabParam = sp?.get("tab") ?? "overview";
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "overview";
  const { meta, error: metaErr } = useFinMeta();
  const [header, setHeader] = useState<Header | null>(null);
  const [headErr, setHeadErr] = useState<string | null>(null);
  const flash = useFlash();
  const [pop, setPop] = useState<ReactNode>(null);
  const [rev, setRev] = useState(0);
  const loadHeader = useCallback(() => {
    if (!sid) return;
    fin<Header>(`/student/${sid}`)
      .then((h) => {
        setHeader(h);
        setHeadErr(null);
      })
      .catch((e) => setHeadErr(errMsg(e, "Could not load the student")));
  }, [sid]);
  useEffect(loadHeader, [loadHeader]);
  const go = (q: Record<string, string>) => {
    const next = new URLSearchParams(sp?.toString() ?? "");
    for (const [k, v] of Object.entries(q)) next.set(k, v);
    router.replace(`${pathname}?${next.toString()}`);
  };

  if (!sid)
    return (
      <FinFrame title="Student Finance" href={`${FIN}/student`} crumbs={["Students", "Finance"]}>
        <section className="mh-sa__card">
          <p>Select a student to open their Finance profile.</p>
          <Field label="Student">
            <StudentPicker value={null} onChange={(w) => w && router.push(`${FIN}/student?ctx=student:${w.id}&tab=overview`)} autoFocus />
          </Field>
        </section>
      </FinFrame>
    );

  const h: H | null =
    meta && header
      ? {
          open: setPop,
          close: () => setPop(null),
          done: (m) => {
            setPop(null);
            flash.ok(m);
            setRev((n) => n + 1);
          },
          refresh: () => setRev((n) => n + 1),
          ok: flash.ok,
          fail: flash.fail,
          meta,
          edit: meta.perms.edit,
          sid,
          header,
          rev,
        }
      : null;

  return (
    <FinFrame title={header ? `${header.name} — Finance` : "Student Finance"} href={`${FIN}/student`} crumbs={["Students", header?.name ?? "Student", "Finance"]}>
      {flash.node}
      {metaErr || headErr ? <div className="mh-sa__notice mh-sa__notice--error">{metaErr ?? headErr}</div> : null}
      {header ? (
        <section className="mh-sa__card fn-head">
          <div className="fn-avatar" aria-hidden>
            {header.initials}
          </div>
          <div className="fn-head__main">
            <h2>
              {header.name}
              {header.preferred && header.preferred !== header.name ? <span className="fn-head__pref"> ({header.preferred})</span> : null}
            </h2>
            <dl className="fn-head__facts">
              <div>
                <dt>Application #</dt>
                <dd>{header.applicationNumber || "—"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{header.status || "—"}</dd>
              </div>
              <div>
                <dt>Campus</dt>
                <dd>{header.campus || "—"}</dd>
              </div>
              <div>
                <dt>Program</dt>
                <dd>{header.program || "—"}</dd>
              </div>
              <div>
                <dt>CGPA</dt>
                <dd>{header.cgpa === null ? "—" : header.cgpa.toFixed(2)}</dd>
              </div>
            </dl>
          </div>
          <Link className="mh-sa__btn mh-sa__btn--sm" href={`${FIN}/student`}>
            Change student
          </Link>
        </section>
      ) : !headErr ? (
        <p className="mh-sa__muted">Loading…</p>
      ) : null}
      {header ? (
        <>
          <nav className="lx-tabs fn-tabs" role="tablist" aria-label="Finance">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`lx-tab${tab === t.id ? " is-active" : ""}`} onClick={() => go({ tab: t.id })}>
                {t.label}
              </button>
            ))}
          </nav>
          {!h ? (
            <p className="mh-sa__muted">Loading…</p>
          ) : tab === "overview" ? (
            <Overview h={h} />
          ) : tab === "transactions" ? (
            <Transactions h={h} />
          ) : tab === "invoices" ? (
            <Invoices h={h} />
          ) : tab === "disbursements" ? (
            <Disbursements h={h} />
          ) : tab === "promotions" ? (
            <Promotions h={h} />
          ) : tab === "plans" ? (
            <Plans h={h} />
          ) : tab === "documents" ? (
            <DocumentsPanel meta={h.meta} studentId={sid} />
          ) : (
            <Audit h={h} />
          )}
        </>
      ) : null}
      {pop}
    </FinFrame>
  );
}

function useStudentData<T>(path: string, rev: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    fin<T>(path)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(errMsg(e, "Could not load")));
  }, [path]);
  useEffect(load, [load, rev]);
  return { data, error, load };
}

const ctxOf = (h: H): ListCtx => ({ reload: () => undefined, ok: h.ok, fail: h.fail, meta: h.meta });
const Err = ({ e }: { e: string | null }) => (e ? <div className="mh-sa__notice mh-sa__notice--error">{e}</div> : null);

/* ------------------------------------------------------------------ */
/* Financial Overview                                                   */
/* ------------------------------------------------------------------ */

type OverviewData = {
  summary: { tuitionOwing: number; tuitionPaid: number; tuitionTotal: number; feesOwing: number; feesPaid: number; feesTotal: number; totalPayments: number; totalCredit: number; totalRefunds: number; balance: number; available: number };
  cards: { funds: { allocated: number; remaining: number }; awards: { allocated: number; remaining: number }; commission: { earned: number; expected: number; agent: string } };
  fees: FeeRow[];
};

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="fn-stat">
      <span>{label}</span>
      <Money v={value} strong={strong} />
    </div>
  );
}

function Overview({ h }: { h: H }) {
  const [typeF, setTypeF] = useState("");
  const [termF, setTermF] = useState("");
  const qs = new URLSearchParams({ ...(typeF ? { ledgerType: typeF } : {}), ...(termF ? { term: termF } : {}) }).toString();
  const { data, error } = useStudentData<OverviewData>(`/student/${h.sid}/overview${qs ? `?${qs}` : ""}`, h.rev);
  const s = data?.summary;
  return (
    <>
      <Err e={error} />
      {s && data ? (
        <div className="fn-cards">
          <section className="mh-sa__card fn-card">
            <h4>Tuition</h4>
            <Stat label="Owing" value={s.tuitionOwing} />
            <Stat label="Paid" value={s.tuitionPaid} />
            <Stat label="Total" value={s.tuitionTotal} strong />
          </section>
          <section className="mh-sa__card fn-card">
            <h4>Fees</h4>
            <Stat label="Owing" value={s.feesOwing} />
            <Stat label="Paid" value={s.feesPaid} />
            <Stat label="Total" value={s.feesTotal} strong />
          </section>
          <section className="mh-sa__card fn-card">
            <h4>Account</h4>
            <Stat label="Total Payments" value={s.totalPayments} />
            <Stat label="Total Credit" value={s.totalCredit} />
            <Stat label="Total Refunds" value={s.totalRefunds} />
            <Stat label="Student Balance" value={s.balance} strong />
          </section>
          <section className="mh-sa__card fn-card">
            <h4>Funds / Disbursements</h4>
            <Stat label="Allocated" value={data.cards.funds.allocated} />
            <Stat label="Remaining" value={data.cards.funds.remaining} />
          </section>
          <section className="mh-sa__card fn-card">
            <h4>Promotions / Awards</h4>
            <Stat label="Allocated" value={data.cards.awards.allocated} />
            <Stat label="Remaining" value={data.cards.awards.remaining} />
          </section>
          <section className="mh-sa__card fn-card">
            <h4 className="fn-card__head">
              Agent Commission
              <button type="button" className="fn-icon" title="Manage Agent" aria-label="Manage Agent" onClick={() => h.open(<ManageAgentModal meta={h.meta} studentId={h.sid} onClose={h.close} onDone={h.done} />)}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                  <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </h4>
            <Stat label="Earned" value={data.cards.commission.earned} />
            <Stat label="Expected" value={data.cards.commission.expected} />
            {data.cards.commission.agent ? <Sub>{data.cards.commission.agent}</Sub> : null}
          </section>
        </div>
      ) : !error ? (
        <p className="mh-sa__muted">Loading…</p>
      ) : null}
      {h.edit ? <ApplyPayment h={h} /> : null}
      <section className="mh-sa__card">
        <div className="fn-row fn-row--between">
          <div className="fn-filters fn-filters--inline">
            <Field label="Ledger Type">
              <Select value={typeF} onChange={setTypeF} options={h.meta.ledgerTypes} all="All Tuition / Ledger Types" />
            </Field>
            <Field label="Term">
              <Select value={termF} onChange={setTermF} options={h.meta.terms} all="All Terms" />
            </Field>
          </div>
          {h.edit ? (
            <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => h.open(<AddFeeModal meta={h.meta} studentId={h.sid} rateCategory={h.header.rateCategory} onClose={h.close} onDone={h.done} />)}>
              Add Fee
            </button>
          ) : null}
        </div>
        <FinTable<FeeRow>
          rows={data?.fees ?? []}
          ctx={ctxOf(h)}
          empty="No fees were found."
          columns={[
            { label: "#", render: (r) => r.number, className: "fn-numcol" },
            {
              label: "Tuition / Ledger Type",
              render: (r) => (
                <>
                  {r.type}
                  {r.termName || r.note ? <Sub>{[r.termName, r.quantity > 1 ? `${r.quantity} × ${money(r.unitAmount)}` : "", r.note].filter(Boolean).join(" · ")}</Sub> : null}
                </>
              ),
            },
            { label: "Status", render: (r) => <Badge text={r.status} /> },
            { label: "Entry Date", render: (r) => fmtDay(r.entryDate) },
            { label: "Posting Date", render: (r) => fmtDay(r.postedDate) },
            { label: "Amount", render: (r) => <Money v={r.amount} />, className: "fn-num" },
            { label: "Paid", render: (r) => <Money v={r.paid} />, className: "fn-num" },
          ]}
          actions={(r) => feeActions(r, h)}
        />
      </section>
    </>
  );
}

function ApplyPayment({ h }: { h: H }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [payee, setPayee] = useState("Student");
  const [ptype, setPtype] = useState("Standard");
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paid, setPaid] = useState<{ id: string; message: string } | null>(null);
  const submit = () => {
    setBusy(true);
    setErr(null);
    setPaid(null);
    fin<{ id: string; message: string }>(`/student/${h.sid}/payments`, json("POST", { amount: amount.trim() === "" ? undefined : Number(amount), date, payee, paymentType: ptype, method, note, autoApply: auto }))
      .then((o) => {
        setPaid(o);
        setAmount("");
        setNote("");
        h.refresh();
      })
      .catch((e) => setErr(errMsg(e, "Could not apply the payment")))
      .finally(() => setBusy(false));
  };
  return (
    <section className="mh-sa__card fn-pay">
      <h3 className="fn-h">Apply New Payment</h3>
      {paid ? (
        <div className="mh-sa__notice mh-sa__notice--success">
          {paid.message}.{" "}
          <button type="button" className="fn-link" onClick={() => downloadPdf(`/transactions/${paid.id}/receipt.pdf`).catch((e) => setErr(errMsg(e, "Could not download the receipt")))}>
            Click here to download the receipt
          </button>
        </div>
      ) : null}
      {err ? <div className="mh-sa__notice mh-sa__notice--error">{err}</div> : null}
      <form
        className="fn-grid fn-grid--4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Payment Amount" required>
          <input className="mh-sa__input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Payment Date" required>
          <input className="mh-sa__input" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Payee">
          <Select value={payee} onChange={setPayee} options={h.meta.constants.payees ?? ["Student", "Institution"]} />
        </Field>
        <Field label="Payment Type" hint={ptype === "Correction" ? "Correction payments may be negative." : undefined}>
          <Select value={ptype} onChange={setPtype} options={h.meta.constants.paymentTypes ?? ["Standard", "Deposit", "Correction"]} />
        </Field>
        <Field label="Payment Method" required>
          <Select value={method} onChange={setMethod} options={h.meta.paymentMethods} placeholder="Select a Payment Method" />
        </Field>
        <Field label="Note" lang wide>
          <input className="mh-sa__input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <label className="mh-sa__check fn-span">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Automatically apply payment to outstanding balances
        </label>
        <div className="fn-span">
          <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
            {busy ? "Applying…" : "APPLY PAYMENT"}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Financial Transactions                                               */
/* ------------------------------------------------------------------ */

type TxData = { items: TxRow[]; allocations: Array<{ id: string; at: string; amount: number; fund: number | null; fee: number | null; feeType: string }>; refundable: Array<{ id: string; number: number; refundable: number; label: string }> };

function Transactions({ h }: { h: H }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showAlloc, setShowAlloc] = useState(false);
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error } = useStudentData<TxData>(`/student/${h.sid}/transactions?q=${encodeURIComponent(debounced)}&showAlloc=${showAlloc}`, h.rev + rev);
  const allocate = (r: TxRow) =>
    fin<{ message: string }>(`/transactions/${r.id}/allocate`, { method: "POST" })
      .then((o) => h.done(o.message))
      .catch((e) => h.fail(errMsg(e, "Could not apply the amount")));
  return (
    <section className="mh-sa__card">
      <Err e={error} />
      <div className="fn-row fn-row--between">
        <div className="fn-filters fn-filters--inline">
          <Field label="Filter">
            <input className="mh-sa__input" placeholder="Enter Transaction #, Date, Status, etc." value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <label className="mh-sa__check fn-check-caps">
            <input type="checkbox" checked={showAlloc} onChange={(e) => setShowAlloc(e.target.checked)} /> SHOW CREDIT ALLOCATION TRANSACTIONS
          </label>
        </div>
        {h.edit ? (
          <button type="button" className="mh-sa__btn" onClick={() => h.open(<RefundModal meta={h.meta} choices={data?.refundable ?? []} onClose={h.close} onDone={h.done} />)}>
            Issue Refund
          </button>
        ) : null}
      </div>
      <FinTable<TxRow>
        rows={data?.items ?? []}
        ctx={ctxOf(h)}
        empty="No transactions were found."
        columns={[
          { label: "#", render: (r) => r.number, className: "fn-numcol" },
          {
            label: "Fund Source",
            render: (r) => (
              <>
                {r.fundSource}
                {r.note ? <Sub>{r.note}</Sub> : null}
              </>
            ),
          },
          { label: "Entry Date", render: (r) => fmtDay(r.entryDate) },
          { label: "Recorded Date", render: (r) => fmtDay(r.recordedDate) },
          { label: "Status", render: (r) => <Badge text={r.status} /> },
          { label: "Type", render: (r) => r.type },
          {
            label: "Balance",
            className: "fn-num",
            render: (r) => (
              <>
                <Money v={r.amount} />
                {r.available > 0.004 ? <Sub>Unapplied {money(r.available)}</Sub> : null}
              </>
            ),
          },
        ]}
        actions={(r) => (
          <>
            {h.edit && r.kind === "payment" && r.refundable > 0.004 ? (
              <LinkBtn onClick={() => h.open(<RefundModal meta={h.meta} target={{ kind: "payment", id: r.id, number: r.number, max: r.refundable, source: r.fundSource, label: `#${r.number}` }} onClose={h.close} onDone={h.done} />)}>REFUND</LinkBtn>
            ) : null}
            {r.kind === "payment" || r.kind === "refund" ? <LinkBtn onClick={() => h.open(<ReceiptModal tx={r} onClose={h.close} onChanged={() => setRev((n) => n + 1)} />)}>RECEIPT</LinkBtn> : null}
            {h.edit && r.available > 0.004 ? <LinkBtn onClick={() => void allocate(r)}>APPLY</LinkBtn> : null}
          </>
        )}
      />
      {showAlloc && data ? (
        <>
          <h4 className="fn-h">Credit Allocations</h4>
          <FinTable
            rows={data.allocations}
            ctx={ctxOf(h)}
            empty="No allocations yet."
            columns={[
              { label: "Date", render: (a) => fmtDay(a.at) },
              { label: "From Transaction", render: (a) => (a.fund ? `#${a.fund}` : "—") },
              { label: "Applied To", render: (a) => (a.fee ? `#${a.fee} ${a.feeType}` : "—") },
              { label: "Amount", render: (a) => <Money v={a.amount} />, className: "fn-num" },
            ]}
          />
        </>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Invoices, disbursements, promotions                                   */
/* ------------------------------------------------------------------ */

function Invoices({ h }: { h: H }) {
  const { data, error } = useStudentData<{ items: InvoiceRow[] }>(`/student/${h.sid}/invoices`, h.rev);
  const who = { id: h.sid, name: h.header.name, number: h.header.applicationNumber };
  return (
    <section className="mh-sa__card">
      <Err e={error} />
      {h.edit ? (
        <div className="fn-row fn-row--end">
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => h.open(<InvoiceEditor meta={h.meta} studentId={h.sid} student={who} onClose={h.close} onDone={h.done} />)}>
            Create Invoice
          </button>
        </div>
      ) : null}
      <FinTable rows={data?.items ?? []} ctx={ctxOf(h)} empty="No invoices were found." columns={invoiceColumns(false)} actions={(r) => invoiceActions(r, h)} />
    </section>
  );
}

function Disbursements({ h }: { h: H }) {
  const { data, error } = useStudentData<{ items: CreditRow[]; available: number }>(`/student/${h.sid}/disbursements`, h.rev);
  return (
    <section className="mh-sa__card">
      <Err e={error} />
      <div className="fn-row fn-row--between">
        <span className="mh-sa__muted">Available credit: {money(data?.available ?? 0)}</span>
        {h.edit ? (
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => h.open(<DisbursementModal meta={h.meta} studentId={h.sid} onClose={h.close} onDone={h.done} />)}>
            Create Disbursement
          </button>
        ) : null}
      </div>
      <FinTable<CreditRow>
        rows={data?.items ?? []}
        ctx={ctxOf(h)}
        empty="No disbursements or credits were found."
        columns={[
          { label: "#", render: (r) => r.number, className: "fn-numcol" },
          {
            label: "Fund Type",
            render: (r) => (
              <>
                {r.type}
                {r.note ? <Sub>{r.note}</Sub> : null}
              </>
            ),
          },
          { label: "Status", render: (r) => <Badge text={r.status} /> },
          { label: "Record Date", render: (r) => fmtDay(r.recordDate) },
          { label: "Total", render: (r) => <Money v={r.total} />, className: "fn-num" },
          { label: "Balance", render: (r) => <Money v={r.balance} />, className: "fn-num" },
          { label: "Allocated", render: (r) => <Money v={r.allocated} />, className: "fn-num" },
        ]}
        actions={(r) => creditActions(r, h)}
      />
    </section>
  );
}

function Promotions({ h }: { h: H }) {
  const { data, error } = useStudentData<{ items: AwardRow[] }>(`/student/${h.sid}/awards`, h.rev);
  return (
    <section className="mh-sa__card">
      <Err e={error} />
      {h.edit ? (
        <div className="fn-row fn-row--end">
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => h.open(<AwardModal meta={h.meta} studentId={h.sid} onClose={h.close} onDone={h.done} />)}>
            Add Promotion / Award
          </button>
        </div>
      ) : null}
      <FinTable rows={data?.items ?? []} ctx={ctxOf(h)} empty="No promotions or awards were found." columns={awardColumns(false)} actions={(r) => awardActions(r, h)} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Payment Plans & Collections                                          */
/* ------------------------------------------------------------------ */

type PlansData = {
  items: PlanRow[];
  balances: { debit: number; credit: number; balance: number };
  collections: Array<{ id: string; agency: string; amount: number; commission: number; status: string; sentAt: string; recalledAt: string; note: string }>;
};

function Plans({ h }: { h: H }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const qs = new URLSearchParams({ ...(q ? { q } : {}), ...(term ? { term } : {}) }).toString();
  const { data, error } = useStudentData<PlansData>(`/student/${h.sid}/plans${qs ? `?${qs}` : ""}`, h.rev);
  const active = data?.collections.some((c) => c.status === "Active");
  const terms = (data?.items.length ?? 0) > 0 || term || q ? h.meta.terms : [];
  return (
    <>
      <section className="mh-sa__card">
        <Err e={error} />
        <div className="fn-row fn-row--between">
          <div className="fn-filters fn-filters--inline">
            <Field label="Filter">
              <input className="mh-sa__input" placeholder="Enter Plan #, Date, Status, etc." value={q} onChange={(e) => setQ(e.target.value)} />
            </Field>
            {terms.length ? (
              <Field label="Term">
                <Select value={term} onChange={setTerm} options={terms} all="All Terms" />
              </Field>
            ) : null}
          </div>
          {h.edit ? (
            <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => h.open(<PlanModal meta={h.meta} studentId={h.sid} onClose={h.close} onDone={h.done} />)}>
              Create Payment Plan
            </button>
          ) : null}
        </div>
        <FinTable rows={data?.items ?? []} ctx={ctxOf(h)} empty="No payment plans were found." columns={planColumns(false)} actions={(r) => planActions(true)(r, h)} />
      </section>
      <section className="mh-sa__card">
        <div className="fn-row fn-row--between">
          <h3 className="fn-h">Collections</h3>
          {h.edit && !active && (data?.balances.balance ?? 0) > 0 && h.meta.collectionAgencies.length ? (
            <button type="button" className="mh-sa__btn" onClick={() => h.open(<CollectionsModal meta={h.meta} studentId={h.sid} balance={data?.balances.balance ?? 0} onClose={h.close} onDone={h.done} />)}>
              Send to Collections
            </button>
          ) : null}
        </div>
        {data ? (
          <dl className="fn-dl fn-dl--inline">
            <dt>Debit Balance</dt>
            <dd>{money(data.balances.debit)}</dd>
            <dt>Credit Balance</dt>
            <dd>{money(data.balances.credit)}</dd>
            <dt>Student Balance</dt>
            <dd>
              <strong>{money(data.balances.balance)}</strong>
            </dd>
          </dl>
        ) : null}
        <FinTable
          rows={data?.collections ?? []}
          ctx={ctxOf(h)}
          empty={h.meta.collectionAgencies.length ? "This account has not been sent to collections." : "No collection agencies are configured (Financial Management › Collection Agencies)."}
          columns={[
            { label: "Agency", render: (c) => c.agency },
            { label: "Amount", render: (c) => <Money v={c.amount} />, className: "fn-num" },
            { label: "Commission", render: (c) => <Money v={c.commission} />, className: "fn-num" },
            { label: "Status", render: (c) => <Badge text={c.status} /> },
            { label: "Sent", render: (c) => fmtDay(c.sentAt) },
            { label: "Recalled", render: (c) => fmtDay(c.recalledAt) },
          ]}
          actions={(c) =>
            h.edit && c.status === "Active" ? (
              <LinkBtn
                onClick={() =>
                  h.open(
                    <ConfirmModal
                      title="Recall from Collections"
                      okLabel="Recall Account"
                      body={`Recall this account from ${c.agency}?`}
                      onClose={h.close}
                      onConfirm={async () => h.done((await fin<{ message: string }>(`/collections/${c.id}/recall`, { method: "POST" })).message)}
                    />,
                  )
                }
              >
                RECALL
              </LinkBtn>
            ) : null
          }
        />
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Audit Trail                                                          */
/* ------------------------------------------------------------------ */

type AuditItem = { id: string; at: string; by: string; action: string; record: string; recordId: string; details: Record<string, unknown> };

function Audit({ h }: { h: H }) {
  const [show, setShow] = useState(false);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = new URLSearchParams({ ...(action ? { action } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  const { data, error } = useStudentData<{ items: AuditItem[]; actions: string[] }>(`/student/${h.sid}/audit${qs ? `?${qs}` : ""}`, h.rev);
  return (
    <section className="mh-sa__card">
      <Err e={error} />
      <div className="fn-row fn-row--end">
        <button type="button" className="fn-link" aria-expanded={show} onClick={() => setShow((v) => !v)}>
          Filters {show ? "▴" : "▾"}
        </button>
      </div>
      {show ? (
        <div className="fn-filters">
          <Field label="Action">
            <Select value={action} onChange={setAction} options={data?.actions ?? []} all="All Actions" />
          </Field>
          <Field label="From">
            <input className="mh-sa__input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input className="mh-sa__input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      ) : null}
      <FinTable<AuditItem>
        rows={data?.items ?? []}
        ctx={ctxOf(h)}
        empty="No financial activity has been recorded for this student yet."
        columns={[
          { label: "Date", render: (a) => new Date(a.at).toLocaleString("en-CA") },
          { label: "By", render: (a) => a.by },
          {
            label: "Action(s)",
            render: (a) => (
              <button type="button" className="fn-link" onClick={() => h.open(<AuditDetailModal item={a} onClose={h.close} />)}>
                {a.action}
                {a.record ? <Sub>{a.record}</Sub> : null}
              </button>
            ),
          },
        ]}
      />
    </section>
  );
}
