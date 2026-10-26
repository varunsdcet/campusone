"use client";

import { useState, type ReactNode } from "react";
import {
  Badge,
  FIN,
  FilterBar,
  FinFrame,
  FinTable,
  LinkBtn,
  Money,
  StudentCell,
  Sub,
  errMsg,
  fin,
  fmtDay,
  money,
  useFinList,
  useFinMeta,
  useFlash,
  type Column,
  type FilterDef,
  type FinMeta,
  type ListCtx,
  type Who,
} from "./kit";
import {
  AdjustmentModal,
  AwardEditModal,
  AwardModal,
  BonusModal,
  ConfirmModal,
  CreditNotesModal,
  DeleteDisbursementModal,
  DeleteFeeModal,
  DeleteFundModal,
  DeletePlanModal,
  DisbursementModal,
  DocumentsPanel,
  EditFeeModal,
  FundModal,
  InvoiceEditor,
  PlanModal,
  ReceiptModal,
  RefundModal,
  ReviewAdjustmentModal,
  type AwardRow,
  type CreditRow,
  type FeeRow,
  type FundRow,
  type InvoiceRow,
  type PlanRow,
  type TxRow,
} from "./forms";

type H = { open: (n: ReactNode) => void; close: () => void; done: (m: string) => void; ctx: ListCtx; edit: boolean; meta: FinMeta };

function RecordsScreen<T extends { id: string }>(p: {
  title: string;
  slug: string;
  path: string;
  filters: FilterDef[];
  submitLabel: string;
  empty: string;
  columns: Column<T>[];
  actions?: (r: T, h: H) => ReactNode;
  head?: (h: H) => ReactNode;
  selectable?: (rows: T[], ids: string[]) => ReactNode;
}) {
  const { meta, error: metaErr } = useFinMeta();
  const list = useFinList<T>(p.path, p.filters);
  const flash = useFlash();
  const [pop, setPop] = useState<ReactNode>(null);
  const [ids, setIds] = useState<string[]>([]);
  const ctx: ListCtx | null = meta ? { reload: list.load, ok: flash.ok, fail: flash.fail, meta } : null;
  const h: H | null = ctx && meta ? { open: setPop, close: () => setPop(null), done: (m) => (setPop(null), flash.ok(m), list.load()), ctx, edit: meta.perms.edit, meta } : null;
  return (
    <FinFrame title={p.title} href={`${FIN}/${p.slug}`} actions={h && h.edit ? p.head?.(h) : null}>
      {flash.node}
      {metaErr || list.error ? <div className="mh-sa__notice mh-sa__notice--error">{metaErr ?? list.error}</div> : null}
      <section className="mh-sa__card">
        {!meta || !h ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : (
          <>
            <FilterBar filters={p.filters} meta={meta} draft={list.draft} setDraft={list.setDraft} onSearch={list.search} submitLabel={p.submitLabel} />
            {p.selectable && ids.length ? <div className="fn-selection">{p.selectable(list.data?.items ?? [], ids)}</div> : null}
            {list.data ? (
              <>
                <FinTable rows={list.data.items} columns={p.columns} ctx={h.ctx} empty={p.empty} actions={p.actions ? (r) => p.actions!(r, h) : undefined} select={p.selectable ? { ids, set: setIds } : undefined} />
                {list.pager}
              </>
            ) : (
              <p className="mh-sa__muted">Loading…</p>
            )}
          </>
        )}
      </section>
      {pop}
    </FinFrame>
  );
}

const campus: FilterDef = { key: "campus", label: "Campus Filter", kind: "select", all: "All Campuses", options: (m) => m.campuses };
const student: FilterDef = { key: "student", label: "Student Filter", kind: "text", placeholder: "Enter student # or last name" };
const studentCol = <T extends { student?: Who }>(): Column<T> => ({ label: "Student", render: (r) => <StudentCell who={r.student ?? null} /> });
const numCol = <T extends { number: number }>(): Column<T> => ({ label: "#", render: (r) => r.number, className: "fn-numcol" });
const moneyCol = <T,>(label: string, get: (r: T) => number): Column<T> => ({ label, render: (r) => <Money v={get(r)} />, className: "fn-num" });

/* ------------------------------------------------------------------ */
/* F01 Transactions                                                     */
/* ------------------------------------------------------------------ */

const TX_FILTERS: FilterDef[] = [
  campus,
  student,
  { key: "dateField", label: "Date Filter", kind: "select", options: () => ["Entry Date", "Recorded Date"], initial: "Entry Date" },
  { key: "range", label: "Filter Date Range", kind: "select", all: "All Dates", options: () => ["Today", "Last 7 Days", "Last 30 Days", "This Month", "This Year", "Custom Range"] },
  { key: "from", label: "From", kind: "date", when: (v) => v.range === "Custom Range" },
  { key: "to", label: "To", kind: "date", when: (v) => v.range === "Custom Range" },
  { key: "number", label: "Transaction #", kind: "text", placeholder: "Enter transaction #" },
  {
    key: "type",
    label: "Transaction Type",
    kind: "select",
    all: "All Transactions",
    groups: [
      { label: "Payments", items: ["All Payments", "Standard payments", "Deposit payments", "Correction payments"] },
      { label: "Refunds / Reimbursements", items: ["All Refunds/Reimbursements", "Credits", "Refunds"] },
    ],
  },
];

export function Transactions() {
  return (
    <RecordsScreen<TxRow>
      title="Financial Transactions"
      slug="transactions"
      path="/transactions"
      filters={TX_FILTERS}
      submitLabel="Search Transactions"
      empty="No transactions were found."
      columns={[
        numCol(),
        studentCol(),
        { label: "Fund Source", render: (r) => r.fundSource },
        { label: "Entry Date", render: (r) => fmtDay(r.entryDate) },
        { label: "Recorded Date", render: (r) => fmtDay(r.recordedDate) },
        {
          label: "Type",
          render: (r) => (
            <>
              {r.type}
              <Sub>
                <Badge text={r.status} />
              </Sub>
            </>
          ),
        },
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
      actions={(r, h) => (r.kind === "payment" || r.kind === "refund" ? <LinkBtn onClick={() => h.open(<ReceiptModal tx={r} onClose={h.close} />)}>RECEIPT</LinkBtn> : null)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* F02 Tuition & Fees                                                   */
/* ------------------------------------------------------------------ */

const FEE_FILTERS: FilterDef[] = [
  campus,
  { key: "ledgerType", label: "Ledger Type", kind: "select", all: "All Tuition / Ledger Types", options: (m) => m.ledgerTypes },
  { key: "number", label: "Receivable Filter", kind: "text", placeholder: "Enter receivable #" },
  student,
  { key: "status", label: "Status", kind: "select", all: "All Statuses", options: () => ["Paid", "Owing", "Returned"] },
];

export function feeActions(r: FeeRow, h: Pick<H, "open" | "close" | "done" | "meta" | "edit">) {
  if (!h.edit || r.status === "Refunded") return null;
  return (
    <>
      <LinkBtn onClick={() => h.open(<EditFeeModal meta={h.meta} fee={r} onClose={h.close} onDone={h.done} />)}>UPDATE</LinkBtn>
      {r.canRemove ? (
        <>
          <span className="fn-sep">|</span>
          <LinkBtn danger onClick={() => h.open(<DeleteFeeModal fee={r} onClose={h.close} onDone={h.done} />)}>
            REMOVE
          </LinkBtn>
        </>
      ) : r.canRefund ? (
        <>
          <span className="fn-sep">|</span>
          <LinkBtn onClick={() => h.open(<RefundModal meta={h.meta} target={{ kind: "fee", id: r.id, number: r.number, max: r.paid, label: r.type }} onClose={h.close} onDone={h.done} />)}>REFUND</LinkBtn>
        </>
      ) : null}
    </>
  );
}

export function Fees() {
  return (
    <RecordsScreen<FeeRow>
      title="Manage Tuition & Fees"
      slug="fees"
      path="/fees"
      filters={FEE_FILTERS}
      submitLabel="Search Fees"
      empty="No fees were found."
      columns={[
        numCol(),
        studentCol(),
        {
          label: "Tuition / Ledger Type",
          render: (r) => (
            <>
              {r.type}
              {r.termName ? <Sub>{r.termName}</Sub> : null}
            </>
          ),
        },
        { label: "Status", render: (r) => <Badge text={r.status} /> },
        { label: "Entry Date", render: (r) => fmtDay(r.entryDate) },
        { label: "Posted Date", render: (r) => fmtDay(r.postedDate) },
        moneyCol("Amount", (r) => r.amount),
        moneyCol("Paid", (r) => r.paid),
      ]}
      actions={feeActions}
    />
  );
}

/* ------------------------------------------------------------------ */
/* F03 Manage Invoices                                                  */
/* ------------------------------------------------------------------ */

const INVOICE_FILTERS: FilterDef[] = [
  campus,
  { key: "type", label: "Type Filter", kind: "select", all: "All Types", options: () => ["Student", "Agent", "Funding Source"] },
  { key: "number", label: "Invoice #", kind: "text", placeholder: "Enter invoice #" },
  student,
];

export const invoiceColumns = (withStudent: boolean): Column<InvoiceRow>[] => [
  numCol(),
  ...(withStudent ? [{ label: "Student", render: (r: InvoiceRow) => (r.type === "Student" ? <StudentCell who={r.student} /> : <strong>{r.type === "Agent" ? r.agent : r.fundingSource}</strong>) }] : []),
  {
    label: "Status",
    render: (r) => (
      <>
        <Badge text={r.status} />
        <Sub>{fmtDay(r.statusDate)}</Sub>
      </>
    ),
  },
  { label: "Type", render: (r) => r.type },
  { label: "Due Date", render: (r) => fmtDay(r.dueDate) },
  moneyCol("Adjustments", (r) => r.adjustments),
  moneyCol("Balance", (r) => r.total),
];

export function invoiceActions(r: InvoiceRow, h: Pick<H, "open" | "close" | "done" | "meta" | "edit">) {
  return (
    <>
      <LinkBtn onClick={() => h.open(<CreditNotesModal invoice={r} onClose={h.close} onDone={h.done} canAdd={h.edit} />)}>NOTES({r.creditNotes.length})</LinkBtn>
      {h.edit ? (
        <>
          <LinkBtn onClick={() => h.open(<InvoiceEditor meta={h.meta} invoiceId={r.id} onClose={h.close} onDone={h.done} />)}>EDIT</LinkBtn>
          <LinkBtn
            danger
            onClick={() =>
              h.open(
                <ConfirmModal
                  title="Delete Invoice"
                  okLabel="Confirm Delete"
                  body={`Delete invoice #${r.number}? Fees already posted to the student's account are kept.`}
                  onClose={h.close}
                  onConfirm={async () => h.done((await fin<{ message: string }>(`/invoices/${r.id}`, { method: "DELETE" })).message)}
                />,
              )
            }
          >
            DELETE
          </LinkBtn>
        </>
      ) : null}
    </>
  );
}

export function Invoices() {
  return (
    <RecordsScreen<InvoiceRow>
      title="Manage Invoices"
      slug="invoices"
      path="/invoices"
      filters={INVOICE_FILTERS}
      submitLabel="Search Invoices"
      empty="No invoices were found."
      columns={invoiceColumns(true)}
      actions={invoiceActions}
      head={(h) => (
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => h.open(<InvoiceEditor meta={h.meta} onClose={h.close} onDone={h.done} />)}>
          Create Invoice
        </button>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* F04 Credits & Disbursements                                          */
/* ------------------------------------------------------------------ */

const DISB_FILTERS: FilterDef[] = [
  campus,
  student,
  { key: "type", label: "Disbursement Type", kind: "select", all: "All Disbursement Types", options: (m) => ["Advance Payment Credit", ...m.disbursementTypes.map((t) => t.name)] },
  { key: "status", label: "Status Filter", kind: "select", all: "All Statuses", options: (m) => m.constants.creditStatuses ?? [] },
  { key: "allocation", label: "Allocation", kind: "select", options: () => ["Both", "Unallocated", "Allocated"], initial: "Both" },
];

export function creditActions(r: CreditRow, h: Pick<H, "open" | "close" | "done" | "meta" | "edit">) {
  if (!h.edit) return null;
  return (
    <>
      <LinkBtn onClick={() => h.open(<DisbursementModal meta={h.meta} credit={r} onClose={h.close} onDone={h.done} />)}>EDIT</LinkBtn>
      {!r.advance && !r.award && !r.fromFund ? (
        <LinkBtn danger onClick={() => h.open(<DeleteDisbursementModal credit={r} onClose={h.close} onDone={h.done} />)}>
          REMOVE
        </LinkBtn>
      ) : null}
    </>
  );
}

export function Disbursements() {
  return (
    <RecordsScreen<CreditRow>
      title="Manage Credits & Disbursements"
      slug="disbursements"
      path="/disbursements"
      filters={DISB_FILTERS}
      submitLabel="Search Disbursements"
      empty="No credits or disbursements were found."
      columns={[
        studentCol(),
        {
          label: "Disbursement Type",
          render: (r) => (
            <>
              {r.type} <span className="mh-sa__muted">#{r.number}</span>
              {r.note ? <Sub>{r.note}</Sub> : null}
            </>
          ),
        },
        { label: "Status", render: (r) => <Badge text={r.status} /> },
        { label: "Record Date", render: (r) => fmtDay(r.recordDate) },
        moneyCol("Balance", (r) => r.balance),
        moneyCol("Allocated", (r) => r.allocated),
        moneyCol("Total", (r) => r.total),
      ]}
      selectable={(rows, ids) => {
        const picked = rows.filter((r) => ids.includes(r.id));
        return (
          <>
            <strong>{picked.length}</strong> selected · Total {money(picked.reduce((a, r) => a + r.total, 0))} · Balance {money(picked.reduce((a, r) => a + r.balance, 0))} · Allocated {money(picked.reduce((a, r) => a + r.allocated, 0))}
          </>
        );
      }}
      actions={creditActions}
      head={(h) => (
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => h.open(<DisbursementModal meta={h.meta} onClose={h.close} onDone={h.done} />)}>
          Create Disbursement
        </button>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* F05 Promotions & Awards                                              */
/* ------------------------------------------------------------------ */

const AWARD_FILTERS: FilterDef[] = [
  { ...campus, label: "Campus" },
  { key: "program", label: "Program", kind: "select", all: "All Programs", options: (m) => m.programs },
  { ...student, label: "Student" },
  { key: "studentStatus", label: "Student Status", kind: "select", all: "All Student Statuses", options: (m) => m.statuses },
  { key: "status", label: "Promotion Status", kind: "select", all: "All Promotion Statuses", options: (m) => m.constants.awardStatuses ?? [] },
];

export const awardColumns = (withStudent: boolean): Column<AwardRow>[] => [
  numCol(),
  ...(withStudent ? [studentCol<AwardRow>()] : []),
  {
    label: "Promotion / Award",
    render: (r) => (
      <>
        {r.promotion}
        <Sub>{[r.type, r.eligibility, r.note].filter(Boolean).join(" · ")}</Sub>
      </>
    ),
  },
  { label: "Status", render: (r) => <Badge text={r.status} /> },
  moneyCol("Amount", (r) => r.amount),
  moneyCol("Allocated", (r) => r.allocated),
  moneyCol("Remaining", (r) => r.remaining),
];

export const awardActions = (r: AwardRow, h: Pick<H, "open" | "close" | "done" | "meta" | "edit">) => (h.edit ? <LinkBtn onClick={() => h.open(<AwardEditModal meta={h.meta} award={r} onClose={h.close} onDone={h.done} />)}>EDIT</LinkBtn> : null);

export function Awards() {
  return (
    <RecordsScreen<AwardRow>
      title="Manage Promotions & Awards"
      slug="awards"
      path="/awards"
      filters={AWARD_FILTERS}
      submitLabel="Search Promotions / Awards"
      empty="No grants / awards were found"
      columns={awardColumns(true)}
      actions={awardActions}
      head={(h) => (
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => h.open(<AwardModal meta={h.meta} onClose={h.close} onDone={h.done} />)}>
          Add Promotion / Award
        </button>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* F06 Adjustments                                                      */
/* ------------------------------------------------------------------ */

type AdjRow = { id: string; number: number; studentId: string; student?: Who; direction: string; amount: number; reason: string; status: string; requestedAt: string; reviewedAt: string; reviewNote: string };

const ADJ_FILTERS: FilterDef[] = [{ ...campus, label: "Campus" }, { ...student, label: "Student" }, { key: "status", label: "Adjustment Status", kind: "select", all: "ALL ADJUSTMENT STATUSES", options: () => ["Pending", "Approved / Complete", "Declined"] }];

export function Adjustments() {
  return (
    <RecordsScreen<AdjRow>
      title="Manage Financial Adjustments"
      slug="adjustments"
      path="/adjustments"
      filters={ADJ_FILTERS}
      submitLabel="Search Adjustments"
      empty="No financial adjustments found"
      columns={[
        numCol(),
        studentCol(),
        { label: "Adjustment Type", render: (r) => r.direction },
        moneyCol("Amount", (r) => r.amount),
        { label: "Reason", render: (r) => r.reason },
        {
          label: "Status",
          render: (r) => (
            <>
              <Badge text={r.status} />
              {r.reviewedAt ? <Sub>{[fmtDay(r.reviewedAt), r.reviewNote].filter(Boolean).join(" · ")}</Sub> : null}
            </>
          ),
        },
        { label: "Requested", render: (r) => fmtDay(r.requestedAt) },
      ]}
      actions={(r, h) => (h.edit && r.status === "Pending" ? <LinkBtn onClick={() => h.open(<ReviewAdjustmentModal adj={r} onClose={h.close} onDone={h.done} />)}>REVIEW</LinkBtn> : null)}
      head={(h) => (
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => h.open(<AdjustmentModal meta={h.meta} onClose={h.close} onDone={h.done} />)}>
          Request Adjustment
        </button>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* F07 Agent Commissions & Bonuses                                      */
/* ------------------------------------------------------------------ */

type CommRow = { id: string; number?: number; studentId: string; student?: Who; agentId: string; agent: string; kind: string; expected: number; earned: number; paid: number; owing: number; status: string; note: string };

const COMM_FILTERS: FilterDef[] = [
  campus,
  { key: "agent", label: "Agent Filter", kind: "text", placeholder: "Enter agent # or last name" },
  student,
  { key: "revenueType", label: "Revenue Type", kind: "select", all: "All", options: () => ["Commissions", "Bonuses"] },
  { key: "paymentStatus", label: "Payment Status", kind: "select", all: "All", options: () => ["Paid", "Owing"] },
];

export function Commissions() {
  return (
    <RecordsScreen<CommRow>
      title="Manage Agent Commissions & Bonuses"
      slug="agent-commissions"
      path="/commissions"
      filters={COMM_FILTERS}
      submitLabel="Search"
      empty="No agent commissions or bonuses were found."
      columns={[
        { label: "Agent", render: (r) => <strong>{r.agent}</strong> },
        { label: "Student", render: (r) => (r.student ? <StudentCell who={r.student} /> : <span className="mh-sa__muted">—</span>) },
        {
          label: "Revenue Type",
          render: (r) => (
            <>
              {r.kind}
              {r.note ? <Sub>{r.note}</Sub> : null}
            </>
          ),
        },
        moneyCol("Expected", (r) => r.expected),
        moneyCol("Earned", (r) => r.earned),
        moneyCol("Paid", (r) => r.paid),
        moneyCol("Owing", (r) => r.owing),
        { label: "Status", render: (r) => <Badge text={r.status} /> },
      ]}
      actions={(r, h) =>
        h.edit ? (
          <>
            {r.status === "Owing" && r.owing > 0.004 ? (
              <LinkBtn
                onClick={() =>
                  h.open(
                    <ConfirmModal
                      title={r.kind === "Bonus" ? "Pay Agent Bonus" : "Pay Agent Commission"}
                      okLabel="Mark as Paid"
                      body={`Mark ${money(r.owing)} owed to ${r.agent} as paid?`}
                      onClose={h.close}
                      onConfirm={async () => h.done((await fin<{ message: string }>("/commissions/pay", { method: "POST", body: JSON.stringify(r.kind === "Bonus" ? { bonusId: r.id } : { studentId: r.studentId }) })).message)}
                    />,
                  )
                }
              >
                MARK PAID
              </LinkBtn>
            ) : null}
            {r.kind === "Bonus" && r.status !== "Paid" ? (
              <LinkBtn
                danger
                onClick={() =>
                  h.open(<ConfirmModal title="Delete Agent Bonus" okLabel="Confirm Delete" body={`Delete the ${money(r.expected)} bonus for ${r.agent}?`} onClose={h.close} onConfirm={async () => h.done((await fin<{ message: string }>(`/commissions/bonus/${r.id}`, { method: "DELETE" })).message)} />)
                }
              >
                DELETE
              </LinkBtn>
            ) : null}
          </>
        ) : null
      }
      head={(h) => (
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => h.open(<BonusModal meta={h.meta} onClose={h.close} onDone={h.done} />)}>
          Add Agent Bonus
        </button>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* F08 Payment Plans                                                    */
/* ------------------------------------------------------------------ */

const PLAN_FILTERS: FilterDef[] = [
  campus,
  { key: "program", label: "Program Filter", kind: "select", all: "All Programs", options: (m) => m.programs },
  { key: "term", label: "Term Filter", kind: "select", all: "All Terms", options: (m) => m.terms },
  { key: "status", label: "Status Filter", kind: "select", all: "All Statuses", options: () => ["Overdue", "Paid To-Date", "Pending First Payment", "Balance Paid"] },
  { key: "number", label: "Plan # Filter", kind: "text", placeholder: "Enter plan #" },
  student,
];

export const planColumns = (withStudent: boolean): Column<PlanRow>[] => [
  numCol(),
  ...(withStudent ? [studentCol<PlanRow>()] : []),
  { label: "Status", render: (r) => <Badge text={r.status} /> },
  {
    label: "Next Payment",
    render: (r) =>
      r.next ? (
        <>
          {fmtDay(r.next.date)}
          <Sub>{money(r.next.amount)}</Sub>
        </>
      ) : (
        "—"
      ),
  },
  ...(withStudent ? [] : [{ label: "Term", render: (r: PlanRow) => r.termName || "—" }]),
  { label: "Instalments", render: (r) => r.instalmentsLabel },
  moneyCol("Interest", (r) => r.interest),
  moneyCol("Debt", (r) => r.debt),
  moneyCol("Paid", (r) => r.paid),
  moneyCol("Remaining", (r) => r.remaining),
];

export const planActions = (startEditable: boolean) => (r: PlanRow, h: Pick<H, "open" | "close" | "done" | "meta" | "edit">) =>
  h.edit ? (
    <>
      <LinkBtn onClick={() => h.open(<PlanModal meta={h.meta} plan={r} startEditable={startEditable} onClose={h.close} onDone={h.done} />)}>EDIT</LinkBtn>
      <LinkBtn danger onClick={() => h.open(<DeletePlanModal plan={r} onClose={h.close} onDone={h.done} />)}>
        DELETE
      </LinkBtn>
    </>
  ) : null;

export function Plans() {
  return (
    <RecordsScreen<PlanRow>
      title="Manage Payment Plans"
      slug="payment-plans"
      path="/plans"
      filters={PLAN_FILTERS}
      submitLabel="Search Payment Plans"
      empty="No payment plans were found."
      columns={planColumns(true)}
      actions={planActions(false)}
      head={(h) => (
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => h.open(<PlanModal meta={h.meta} onClose={h.close} onDone={h.done} />)}>
          Create Payment Plan
        </button>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* F09 Documents / Tax Forms                                            */
/* ------------------------------------------------------------------ */

export function Documents() {
  const { meta, error } = useFinMeta();
  return (
    <FinFrame title="Documents & Tax Forms" href={`${FIN}/documents`}>
      {error ? <div className="mh-sa__notice mh-sa__notice--error">{error}</div> : null}
      {meta ? <DocumentsPanel meta={meta} /> : <p className="mh-sa__muted">Loading…</p>}
    </FinFrame>
  );
}

/* ------------------------------------------------------------------ */
/* F10 Unallocated Funds                                                */
/* ------------------------------------------------------------------ */

const FUND_FILTERS: FilterDef[] = [
  campus,
  { key: "number", label: "Entry #", kind: "text", placeholder: "Enter entry #" },
  { key: "keyword", label: "Keyword", kind: "text", placeholder: "Balance, Receipt #, Notes, etc." },
  { key: "status", label: "Status", kind: "select", all: "All Statuses", options: () => ["Unallocated", "Allocated"] },
];

export function Funds() {
  return (
    <RecordsScreen<FundRow>
      title="Manage Unallocated Funds"
      slug="unallocated-funds"
      path="/funds"
      filters={FUND_FILTERS}
      submitLabel="Search Funds"
      empty="No unallocated funds were found."
      columns={[
        numCol(),
        {
          label: "Status",
          render: (r) => (
            <>
              <Badge text={r.status} />
              <Sub>{[r.method, r.receipt ? `Receipt #${r.receipt}` : "", r.note].filter(Boolean).join(" · ")}</Sub>
            </>
          ),
        },
        moneyCol("Unallocated", (r) => r.unallocated),
        moneyCol("Allocated", (r) => r.allocated),
        moneyCol("Total", (r) => r.amount),
        { label: "Received Date", render: (r) => fmtDay(r.receivedDate) },
        { label: "Recorded Date", render: (r) => fmtDay(r.recordedDate) },
      ]}
      actions={(r, h) =>
        h.edit ? (
          <>
            <LinkBtn onClick={() => h.open(<FundModal meta={h.meta} fund={r} onClose={h.close} onDone={h.done} />)}>MANAGE</LinkBtn>
            <LinkBtn danger onClick={() => h.open(<DeleteFundModal fund={r} onClose={h.close} onDone={h.done} />)}>
              REMOVE
            </LinkBtn>
          </>
        ) : null
      }
      head={(h) => (
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => h.open(<FundModal meta={h.meta} onClose={h.close} onDone={h.done} />)}>
          Add Unallocated Fund
        </button>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* F11 Financial Alerts                                                 */
/* ------------------------------------------------------------------ */

type AlertRow = { id: string; studentId: string; student?: Who; kind: string; message: string; status: string; resolved: string; raisedAt: string; resolvedAt: string };

const ALERT_FILTERS: FilterDef[] = [
  campus,
  student,
  { key: "status", label: "Status", kind: "select", options: () => ["Active", "Dismissed"], initial: "Active" },
  { key: "resolved", label: "Resolved", kind: "select", options: () => ["No", "Yes"], initial: "No" },
];

function alertAct(r: AlertRow, action: string, h: H) {
  fin<{ message: string }>(`/alerts/${r.id}/${action}`, { method: "POST" })
    .then((o) => h.done(o.message))
    .catch((e) => h.ctx.fail(errMsg(e, "Could not update the alert")));
}

export function Alerts() {
  return (
    <RecordsScreen<AlertRow>
      title="Financial Alerts"
      slug="alerts"
      path="/alerts"
      filters={ALERT_FILTERS}
      submitLabel="Search Alerts"
      empty="No financial alerts were found."
      columns={[
        studentCol(),
        {
          label: "Alert",
          render: (r) => (
            <>
              <strong>{r.kind}</strong>
              <Sub>{r.message}</Sub>
            </>
          ),
        },
        { label: "Raised", render: (r) => fmtDay(r.raisedAt) },
        { label: "Status", render: (r) => <Badge text={r.status} /> },
        { label: "Resolved", render: (r) => (r.resolved === "Yes" ? `Yes${r.resolvedAt ? ` · ${fmtDay(r.resolvedAt)}` : ""}` : "No") },
      ]}
      actions={(r, h) =>
        h.edit ? (
          <>
            <LinkBtn onClick={() => alertAct(r, r.status === "Dismissed" ? "restore" : "dismiss", h)}>{r.status === "Dismissed" ? "RESTORE" : "DISMISS"}</LinkBtn>
            <LinkBtn onClick={() => alertAct(r, r.resolved === "Yes" ? "reopen" : "resolve", h)}>{r.resolved === "Yes" ? "REOPEN" : "RESOLVE"}</LinkBtn>
          </>
        ) : null
      }
    />
  );
}

export const RECORDS: Record<string, () => ReactNode> = {
  transactions: Transactions,
  fees: Fees,
  invoices: Invoices,
  disbursements: Disbursements,
  awards: Awards,
  adjustments: Adjustments,
  "agent-commissions": Commissions,
  "payment-plans": Plans,
  documents: Documents,
  "unallocated-funds": Funds,
  alerts: Alerts,
};
