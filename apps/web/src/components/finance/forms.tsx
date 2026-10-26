"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActionModal,
  AgentPicker,
  Badge,
  FIN,
  Field,
  Modal,
  Money,
  Select,
  StudentPicker,
  downloadPdf,
  errMsg,
  fin,
  fmtDay,
  json,
  money,
  str,
  today,
  type FinMeta,
  type Who,
} from "./kit";

export type Done = (message: string) => void;
type Base = { meta: FinMeta; onClose: () => void; onDone: Done };

export type FeeRow = {
  id: string;
  number: number;
  studentId: string;
  ledgerTypeId: string;
  type: string;
  status: string;
  entryDate: string;
  postedDate: string;
  amount: number;
  paid: number;
  owing: number;
  quantity: number;
  unitAmount: number;
  termId: string;
  termName: string;
  note: string;
  canRemove: boolean;
  canRefund: boolean;
  student?: Who;
};
export type TxRow = {
  id: string;
  number: number;
  studentId: string;
  kind: string;
  type: string;
  fundSource: string;
  entryDate: string;
  recordedDate: string;
  status: string;
  amount: number;
  available: number;
  refundable: number;
  note: string;
  hasReceipt?: boolean;
  student?: Who;
};
export type CreditRow = {
  id: string;
  number: number;
  studentId: string;
  type: string;
  typeId: string;
  status: string;
  recordDate: string;
  total: number;
  balance: number;
  allocated: number;
  note: string;
  advance: boolean;
  award: boolean;
  fromFund: boolean;
  student?: Who;
};
export type AwardRow = { id: string; number: number; studentId: string; promotion: string; type: string; status: string; allocation: string; eligibility: string; note: string; amount: number; allocated: number; remaining: number; student?: Who };
export type PlanRow = {
  id: string;
  number: number;
  studentId: string;
  status: string;
  next: { date: string; amount: number } | null;
  termId: string;
  termName: string;
  startDate: string;
  syncBalance: string;
  scheduleType: string;
  frequency: string;
  instalmentAmount: number;
  instalmentsLabel: string;
  instalments: Array<{ date: string; amount: number }>;
  interest: number;
  interestRate: number;
  debt: number;
  debtInput: number;
  paid: number;
  remaining: number;
  prompts: string;
  notes: string;
  includeCredit: boolean;
  applyInterest: boolean;
  manual: Array<{ date: string; amount: number }>;
  student?: Who;
};
export type InvoiceItem = { id: string; kind: string; refId: string; ledgerTypeId: string; quantity: number; description: string; fee: number; total: number; status?: string; number?: number };
export type InvoiceRow = {
  id: string;
  number: number;
  type: string;
  studentId: string;
  student: (Who & { email?: string }) | null;
  agentId: string;
  agent: string;
  fundingSourceId: string;
  fundingSource: string;
  dueDate: string;
  termId: string;
  template: string;
  items: InvoiceItem[];
  subtotal: number;
  totalPayments: number;
  adjustments: number;
  total: number;
  status: string;
  statusDate: string;
  creditNotes: Array<{ number?: number; date?: string; amount?: number; note?: string }>;
  note: string;
  sentAt: string;
  sentTo: string;
};
export type FundRow = {
  id: string;
  number: number;
  status: string;
  note: string;
  amount: number;
  allocated: number;
  unallocated: number;
  receivedDate: string;
  recordedDate: string;
  methodId: string;
  method: string;
  receipt: string;
  fundingSourceId: string;
  allocations: Array<{ id: string; studentId: string; amount: number; as: string; at: string; student: string; studentNumber: string }>;
};

type FeeSection = { sectionId: string; courseId: string; label: string; termName: string; enrolmentStatus: string };

const QTY = Array.from({ length: 20 }, (_, i) => String(i + 1));
const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
const isIntl = (rate?: string) => /international/i.test(rate ?? "");

function StudentStep({ who, setWho, label = "Student" }: { who: Who; setWho: (w: Who) => void; label?: string }) {
  return (
    <Field label={label} required>
      <StudentPicker value={who} onChange={setWho} autoFocus={!who} />
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* Fees                                                                 */
/* ------------------------------------------------------------------ */

export function AddFeeModal({ meta, onClose, onDone, studentId, rateCategory }: Omit<Base, "onDone"> & { studentId: string; rateCategory?: string; onDone: (message: string, fee?: { id: string; number: number }) => void }) {
  const [typeId, setTypeId] = useState("");
  const type = meta.ledgerTypes.find((t) => t.id === typeId);
  const [amount, setAmount] = useState("");
  const [qty, setQty] = useState("1");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState(meta.constants.paymentStatuses?.[0] ?? "Pending / Not Paid");
  const [note, setNote] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [sections, setSections] = useState<FeeSection[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    let live = true;
    Promise.all([fin<{ items: FeeSection[] }>(`/student/${studentId}/fee-sections`), fin<Array<{ id: string; label: string }>>("/courses")])
      .then(([s, c]) => {
        if (!live) return;
        setSections(s.items);
        setCourses(c.map((x) => ({ id: x.id, name: x.label })));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [studentId]);
  const section = sections.find((x) => x.sectionId === sectionId);
  const pick = (id: string) => {
    setTypeId(id);
    const t = meta.ledgerTypes.find((x) => x.id === id);
    if (t) setAmount(String(isIntl(rateCategory) ? t.international : t.domestic));
  };
  return (
    <ActionModal
      title="Add Fee"
      submitLabel="Save Fee"
      onClose={onClose}
      onSubmit={async () => {
        const out = await fin<{ id: string; number: number; message: string }>(
          `/student/${studentId}/fees`,
          json("POST", { ledgerTypeId: typeId, amount: num(amount), quantity: Number(qty), termId: term, paymentStatus: status, note, sectionId: sectionId || undefined, courseId: sectionId ? undefined : courseId || undefined }),
        );
        onDone(out.message, { id: out.id, number: out.number });
      }}
    >
      <Field label="Tuition / Ledger Type" required>
        <Select value={typeId} onChange={pick} options={meta.ledgerTypes} placeholder="Select a Tuition / Ledger Type" />
      </Field>
      <Field label="Course Section" hint={sections.length ? "Links the fee to one of the student's course sections." : "The student has no course enrolments yet."}>
        <Select
          value={sectionId}
          onChange={(v) => {
            setSectionId(v);
            if (v) setCourseId("");
          }}
          options={sections.map((x) => ({ id: x.sectionId, name: `${x.label} · ${x.termName}${x.enrolmentStatus === "enrolled" ? "" : ` (${x.enrolmentStatus})`}` }))}
          placeholder="Not linked to a section"
        />
      </Field>
      {!sectionId ? (
        <Field label="Course">
          <Select value={courseId} onChange={setCourseId} options={courses} placeholder="Not linked to a course" />
        </Field>
      ) : null}
      <Field label="Fee Amount" required hint={type && !type.overridable ? "This type is not overridable; the default amount applies." : undefined}>
        <input className="mh-sa__input" type="number" step="0.01" min="0" value={amount} readOnly={Boolean(type && !type.overridable)} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Quantity">
        <Select value={qty} onChange={setQty} options={QTY} />
      </Field>
      <Field label="Apply to Term" hint={section && !term ? `Defaults to the section's term (${section.termName}).` : undefined}>
        <Select value={term} onChange={setTerm} options={meta.terms} placeholder={section ? `Section term (${section.termName})` : "No term"} />
      </Field>
      <Field label="Payment Status">
        <Select value={status} onChange={setStatus} options={meta.constants.paymentStatuses ?? []} />
      </Field>
      <Field label="Fee Note / Comment" lang wide>
        <textarea className="mh-sa__input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </ActionModal>
  );
}

export function EditFeeModal({ meta, onClose, onDone, fee }: Base & { fee: FeeRow }) {
  const [amount, setAmount] = useState(String(fee.unitAmount));
  const [qty, setQty] = useState(String(fee.quantity || 1));
  const [term, setTerm] = useState(fee.termId);
  const [note, setNote] = useState(fee.note);
  const qtys = QTY.includes(qty) ? QTY : [...QTY, qty];
  return (
    <ActionModal
      title={`EDIT FEE: ${fee.type}`}
      submitLabel="Save Fee"
      onClose={onClose}
      onSubmit={async () => {
        const out = await fin<{ message: string }>(`/fees/${fee.id}`, json("PATCH", { amount: num(amount), quantity: Number(qty), termId: term, note }));
        onDone(out.message);
      }}
    >
      <Field label="Fee Amount" required>
        <input className="mh-sa__input" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Quantity">
        <Select value={qty} onChange={setQty} options={qtys} />
      </Field>
      <Field label="Apply to Term">
        <Select value={term} onChange={setTerm} options={meta.terms} placeholder="No term" />
      </Field>
      <Field label="Fee Note / Comment" lang wide>
        <textarea className="mh-sa__input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </ActionModal>
  );
}

export function ConfirmModal({ title, body, okLabel, onClose, onConfirm }: { title: string; body: ReactNode; okLabel: string; onClose: () => void; onConfirm: () => Promise<void> }) {
  return (
    <ActionModal title={title} submitLabel={okLabel} danger onClose={onClose} onSubmit={onConfirm}>
      <p>{body}</p>
    </ActionModal>
  );
}

export function DeleteFeeModal({ fee, onClose, onDone }: { fee: FeeRow; onClose: () => void; onDone: Done }) {
  return (
    <ConfirmModal
      title={`DELETE FEE: ${fee.type}`}
      okLabel="Confirm Delete Fee"
      onClose={onClose}
      body={
        <>
          Delete fee #{fee.number} ({fee.type}, {money(fee.amount)})? The fee is removed from the student&apos;s account.
        </>
      }
      onConfirm={async () => onDone((await fin<{ message: string }>(`/fees/${fee.id}`, { method: "DELETE" })).message)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Refunds and receipts                                                 */
/* ------------------------------------------------------------------ */

type RefundTarget = { kind: "payment" | "fee"; id: string; number: number; max: number; source?: string; label: string };

export function RefundModal({ meta, onClose, onDone, target, choices }: Base & { target?: RefundTarget; choices?: Array<{ id: string; number: number; refundable: number; label: string }> }) {
  const [pickId, setPickId] = useState(target?.id ?? choices?.[0]?.id ?? "");
  const chosen: RefundTarget | undefined = target ?? (choices ?? []).filter((c) => c.id === pickId).map((c) => ({ kind: "payment" as const, id: c.id, number: c.number, max: c.refundable, label: c.label, source: c.label.replace(/^#\d+ /, "").replace(/ \d{4}-\d{2}-\d{2}$/, "") }))[0];
  const sourceId = meta.paymentMethods.find((m) => chosen?.source && (m.name === chosen.source || chosen.source.startsWith(m.name)))?.id ?? "";
  const [type, setType] = useState("Cash Back");
  const [method, setMethod] = useState(sourceId);
  const [amount, setAmount] = useState(chosen ? String(chosen.max) : "");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!target && chosen) {
      setAmount(String(chosen.max));
      setMethod(sourceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickId]);
  return (
    <ActionModal
      title={target?.kind === "fee" ? `Refund Fee: ${target.label}` : "Refund Payment"}
      submitLabel="Issue Refund"
      disabled={!chosen}
      onClose={onClose}
      onSubmit={async () => {
        if (!chosen) return;
        const path = chosen.kind === "fee" ? `/fees/${chosen.id}/refund` : `/transactions/${chosen.id}/refund`;
        onDone((await fin<{ message: string }>(path, json("POST", { refundType: type, method, amount: num(amount), date, note }))).message);
      }}
    >
      {!target ? (
        choices?.length ? (
          <Field label="Payment" required>
            <Select value={pickId} onChange={setPickId} options={choices.map((c) => ({ id: c.id, name: `${c.label} (refundable ${money(c.refundable)})` }))} />
          </Field>
        ) : (
          <p className="mh-sa__muted">This student has no payments that can be refunded.</p>
        )
      ) : (
        <p className="fn-modal__lead">
          {target.kind === "fee" ? "Fee" : "Transaction"} #{target.number} · refundable up to <strong>{money(target.max)}</strong>
        </p>
      )}
      <Field label="Refund Type">
        <Select value={type} onChange={setType} options={["Cash Back", "Apply Credit"]} />
      </Field>
      {type === "Cash Back" ? (
        <Field label="Refund Method" required hint={chosen?.source ? `Originating payment source: ${chosen.source}` : undefined}>
          <Select value={method} onChange={setMethod} options={meta.paymentMethods} placeholder="Select a Refund Method" />
        </Field>
      ) : (
        <p className="lx-hint">The refunded amount is kept on the student&apos;s account as an Advance Payment Credit.</p>
      )}
      <Field label="Refund Amount" required>
        <input className="mh-sa__input" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Refund Date" required>
        <input className="mh-sa__input" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Note / Comment" lang wide>
        <textarea className="mh-sa__input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </ActionModal>
  );
}

export function ReceiptModal({ tx, onClose, onChanged }: { tx: Pick<TxRow, "id" | "number" | "fundSource" | "kind">; onClose: () => void; onChanged?: () => void }) {
  const [info, setInfo] = useState<{ kind: string; receipt: { receiptNumber: number; generatedAt: string } | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const load = () =>
    fin<typeof info>(`/transactions/${tx.id}/receipt`)
      .then(setInfo)
      .catch((e) => setMsg({ tone: "error", text: errMsg(e, "Could not load the receipt") }));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.id]);
  const generate = () => {
    setBusy(true);
    fin<{ message: string }>(`/transactions/${tx.id}/receipt`, { method: "POST" })
      .then((o) => {
        setMsg({ tone: "success", text: o.message });
        onChanged?.();
        return load();
      })
      .catch((e) => setMsg({ tone: "error", text: errMsg(e, "Could not generate the receipt") }))
      .finally(() => setBusy(false));
  };
  const download = () => downloadPdf(`/transactions/${tx.id}/receipt.pdf`).catch((e) => setMsg({ tone: "error", text: errMsg(e, "Could not download the receipt") }));
  const supported = tx.kind === "payment" || tx.kind === "refund";
  return (
    <Modal
      title={info?.receipt ? `Receipt #${info.receipt.receiptNumber}` : `Receipt: Transaction #${tx.number}`}
      onClose={onClose}
      footer={
        supported && info ? (
          info.receipt ? (
            <>
              <button type="button" className="mh-sa__btn" disabled={busy} onClick={generate}>
                Re-Generate Receipt
              </button>
              <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={download}>
                Download Receipt
              </button>
            </>
          ) : (
            <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy} onClick={generate}>
              Generate Receipt
            </button>
          )
        ) : undefined
      }
    >
      {msg ? <div className={`mh-sa__notice mh-sa__notice--${msg.tone}`}>{msg.text}</div> : null}
      <dl className="fn-dl">
        <dt>Transaction #</dt>
        <dd>{tx.number}</dd>
        <dt>Payment Source</dt>
        <dd>{tx.fundSource || "—"}</dd>
        {info?.receipt ? (
          <>
            <dt>Receipt #</dt>
            <dd>{info.receipt.receiptNumber}</dd>
            <dt>Generated</dt>
            <dd>{new Date(info.receipt.generatedAt).toLocaleString("en-CA")}</dd>
          </>
        ) : null}
      </dl>
      {!supported ? <p className="mh-sa__muted">Receipts are available for payments and refunds only.</p> : info && !info.receipt ? <p className="mh-sa__muted">No receipt has been generated for this transaction yet.</p> : null}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Disbursements                                                        */
/* ------------------------------------------------------------------ */

export function DisbursementModal({ meta, onClose, onDone, studentId, credit }: Base & { studentId?: string; credit?: CreditRow }) {
  const [who, setWho] = useState<Who>(null);
  const sid = studentId ?? credit?.studentId ?? who?.id ?? "";
  const [typeId, setTypeId] = useState(credit?.typeId ?? "");
  const [amount, setAmount] = useState(credit ? String(credit.total) : "");
  const [note, setNote] = useState(credit?.note ?? "");
  const noteOnly = Boolean(credit && (credit.advance || credit.award));
  return (
    <ActionModal
      title={credit?.advance ? "Update Advanced Payment Credit" : credit ? "Edit Disbursement" : "Create Disbursement"}
      submitLabel="Save Disbursement"
      disabled={!sid}
      onClose={onClose}
      onSubmit={async () => {
        const out = credit
          ? await fin<{ message: string }>(`/disbursements/${credit.id}`, json("PATCH", noteOnly ? { note } : { typeId, amount: num(amount), note }))
          : await fin<{ message: string }>(`/student/${sid}/disbursements`, json("POST", { typeId, amount: num(amount), note }));
        onDone(out.message);
      }}
    >
      {!studentId && !credit ? <StudentStep who={who} setWho={setWho} /> : null}
      {noteOnly ? (
        <>
          <dl className="fn-dl">
            <dt>{credit?.advance ? "Credit Amount" : "Disbursement Type"}</dt>
            <dd>{credit?.advance ? money(credit.total) : credit?.type}</dd>
            {credit?.award ? (
              <>
                <dt>Disbursement Amount</dt>
                <dd>{money(credit.total)}</dd>
              </>
            ) : null}
          </dl>
          {credit?.award ? <p className="lx-hint">This credit belongs to a promotion / award; change the award to change its amount or status.</p> : null}
        </>
      ) : sid ? (
        <>
          <Field label="Disbursement Type" required>
            <Select value={typeId} onChange={setTypeId} options={meta.disbursementTypes} placeholder="Select a Disbursement Type" />
          </Field>
          <Field label="Disbursement Amount" required>
            <input className="mh-sa__input" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        </>
      ) : null}
      {sid ? (
        <Field label="Note / Comment" lang wide>
          <textarea className="mh-sa__input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      ) : null}
    </ActionModal>
  );
}

export function DeleteDisbursementModal({ credit, onClose, onDone }: { credit: CreditRow; onClose: () => void; onDone: Done }) {
  return (
    <ConfirmModal
      title="Delete Disbursement"
      okLabel="Delete Disbursement"
      onClose={onClose}
      body={`Remove disbursement #${credit.number} (${credit.type}, ${money(credit.total)})? Any amount allocated to fees is released.`}
      onConfirm={async () => onDone((await fin<{ message: string }>(`/disbursements/${credit.id}`, { method: "DELETE" })).message)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Promotions / awards                                                  */
/* ------------------------------------------------------------------ */

type Eligible = { id: string; name: string; type: string; eligibility: string; amount: number; distribution: string };

export function AwardModal({ meta, onClose, onDone, studentId }: Base & { studentId?: string }) {
  const [who, setWho] = useState<Who>(null);
  const sid = studentId ?? who?.id ?? "";
  const [eligible, setEligible] = useState<Eligible[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [promotionId, setPromotionId] = useState("");
  const [status, setStatus] = useState("Active");
  const [allocation, setAllocation] = useState(meta.promotionAllocations[0]?.name ?? "");
  const [eligibility, setEligibility] = useState("Manual");
  const [note, setNote] = useState("");
  useEffect(() => {
    setEligible(null);
    setPromotionId("");
    if (!sid) return;
    fin<{ eligible: Eligible[] }>(`/student/${sid}/awards`)
      .then((r) => setEligible(r.eligible))
      .catch((e) => setLoadErr(errMsg(e, "Could not load promotions")));
  }, [sid]);
  const pick = eligible?.find((e) => e.id === promotionId);
  return (
    <ActionModal
      title="Add Promotion / Award"
      submitLabel="Save Promotion / Award"
      disabled={!sid || !eligible?.length || !allocation}
      onClose={onClose}
      onSubmit={async () => onDone((await fin<{ message: string }>(`/student/${sid}/awards`, json("POST", { promotionId, status, allocation, eligibility, note }))).message)}
    >
      {!studentId ? <StudentStep who={who} setWho={setWho} /> : null}
      {loadErr ? <div className="mh-sa__notice mh-sa__notice--error">{loadErr}</div> : null}
      {sid && eligible ? (
        <>
          {!eligible.length ? (
            <div className="mh-sa__notice mh-sa__notice--warning fn-warning">
              {meta.promotions.some((p) => p.status === "Active") ? "This student does not currently meet any promotion or award eligibility rules." : "No active promotions or awards are configured."}{" "}
              <a href={`${FIN}/promotions/new`}>Add Promotion / Award</a>
            </div>
          ) : null}
          <Field label="Promotion / Award" required hint={pick ? `${pick.type} · ${money(pick.amount)} · ${pick.distribution}` : undefined}>
            <Select value={promotionId} onChange={setPromotionId} options={eligible.map((e) => ({ id: e.id, name: e.name }))} placeholder="Select a Promotion / Award" />
          </Field>
          <Field label="Promotion / Award Status">
            <Select value={status} onChange={setStatus} options={["Active", "Inactive"]} />
          </Field>
          <Field label="Promotion Allocation">
            <Select value={allocation} onChange={setAllocation} options={meta.promotionAllocations.map((option) => option.name)} placeholder="Select a Promotion Allocation" />
            <span className="lx-hint">
              {meta.promotionAllocations.length ? "Options come from the Promotion Allocations master. " : "No active options. "}
              <a href={`${FIN}/promotion-allocations`}>Manage Promotion Allocations</a>
            </span>
          </Field>
          <Field label="Promotion Eligibility">
            <Select value={eligibility} onChange={setEligibility} options={["Manual", "Automated"]} />
          </Field>
          <Field label="Note / Comment" lang wide>
            <textarea className="mh-sa__input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </>
      ) : sid ? (
        <p className="mh-sa__muted">Checking eligibility…</p>
      ) : null}
    </ActionModal>
  );
}

export function AwardEditModal({ meta, onClose, onDone, award }: Base & { award: AwardRow }) {
  const [status, setStatus] = useState(award.status);
  const [note, setNote] = useState(award.note);
  return (
    <ActionModal
      title={`Edit Promotion / Award #${award.number}`}
      submitLabel="Save Promotion / Award"
      onClose={onClose}
      onSubmit={async () => onDone((await fin<{ message: string }>(`/awards/${award.id}`, json("PATCH", { status, note }))).message)}
    >
      <dl className="fn-dl">
        <dt>Promotion / Award</dt>
        <dd>{award.promotion}</dd>
        <dt>Amount</dt>
        <dd>{money(award.amount)}</dd>
      </dl>
      <Field label="Promotion / Award Status" hint="Any status other than Active releases the amount allocated to fees.">
        <Select value={status} onChange={setStatus} options={meta.constants.awardStatuses ?? []} />
      </Field>
      <Field label="Note / Comment" lang wide>
        <textarea className="mh-sa__input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </ActionModal>
  );
}

/* ------------------------------------------------------------------ */
/* Adjustments                                                          */
/* ------------------------------------------------------------------ */

export function AdjustmentModal({ meta, onClose, onDone }: Base) {
  const [who, setWho] = useState<Who>(null);
  const [direction, setDirection] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  return (
    <ActionModal
      title="Request Adjustment"
      submitLabel="Submit Adjustment"
      disabled={!who}
      onClose={onClose}
      onSubmit={async () => onDone((await fin<{ message: string }>("/adjustments", json("POST", { studentId: who?.id, direction, amount: num(amount), reason }))).message)}
    >
      <StudentStep who={who} setWho={setWho} />
      <Field label="Adjustment Type" required>
        <Select value={direction} onChange={setDirection} options={meta.constants.adjustmentDirections ?? []} placeholder="Select an Adjustment Type" />
      </Field>
      <Field label="Adjustment Amount" required>
        <input className="mh-sa__input" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Reason" required lang wide>
        <textarea className="mh-sa__input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <p className="lx-hint">The adjustment is posted to the student ledger only after it is approved.</p>
    </ActionModal>
  );
}

export function ReviewAdjustmentModal({ adj, onClose, onDone }: { adj: { id: string; number: number; direction: string; amount: number; reason: string; student?: Who }; onClose: () => void; onDone: Done }) {
  const [decision, setDecision] = useState("Approved / Complete");
  const [note, setNote] = useState("");
  return (
    <ActionModal title={`Review Adjustment #${adj.number}`} submitLabel="Save Decision" onClose={onClose} onSubmit={async () => onDone((await fin<{ message: string }>(`/adjustments/${adj.id}/review`, json("POST", { decision, note }))).message)}>
      <dl className="fn-dl">
        <dt>Student</dt>
        <dd>{adj.student ? `${adj.student.name} (#${adj.student.number})` : "—"}</dd>
        <dt>Adjustment</dt>
        <dd>
          {adj.direction} · {money(adj.amount)}
        </dd>
        <dt>Reason</dt>
        <dd>{adj.reason}</dd>
      </dl>
      <Field label="Decision">
        <Select value={decision} onChange={setDecision} options={["Approved / Complete", "Declined"]} />
      </Field>
      <Field label="Note / Comment" lang wide>
        <textarea className="mh-sa__input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </ActionModal>
  );
}

/* ------------------------------------------------------------------ */
/* Agent bonus                                                          */
/* ------------------------------------------------------------------ */

export function BonusModal({ meta, onClose, onDone }: Base) {
  const [agentId, setAgentId] = useState("");
  const [who, setWho] = useState<Who>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <ActionModal
      title="Create Agent Bonus"
      submitLabel="Save Agent Bonus"
      disabled={!agentId}
      onClose={onClose}
      onSubmit={async () => onDone((await fin<{ message: string }>("/commissions/bonus", json("POST", { agentId, studentId: who?.id ?? "", amount: num(amount), note }))).message)}
    >
      <Field label="Agent" required>
        {meta.agents.length ? <AgentPicker meta={meta} value={agentId} onChange={setAgentId} /> : <p className="mh-sa__muted">No agents are set up yet.</p>}
      </Field>
      {agentId ? (
        <>
          <Field label="Student" hint="Optional: the student this bonus relates to.">
            <StudentPicker value={who} onChange={setWho} />
          </Field>
          <Field label="Bonus Amount" required>
            <input className="mh-sa__input" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Note / Comment" lang wide>
            <textarea className="mh-sa__input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </>
      ) : null}
    </ActionModal>
  );
}

/* ------------------------------------------------------------------ */
/* Payment plans                                                        */
/* ------------------------------------------------------------------ */

type PlanCtx = { balances: { debit: number; credit: number; balance: number }; termBalances: Record<string, number> };

export function PlanModal({ meta, onClose, onDone, studentId, plan, startEditable = true }: Base & { studentId?: string; plan?: PlanRow; startEditable?: boolean }) {
  const [who, setWho] = useState<Who>(null);
  const sid = plan?.studentId ?? studentId ?? who?.id ?? "";
  const [ctx, setCtx] = useState<PlanCtx | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [startDate, setStartDate] = useState(plan?.startDate ?? today());
  const [termId, setTermId] = useState(plan?.termId ?? "");
  const [sync, setSync] = useState(plan?.syncBalance ?? "Disabled");
  const [debt, setDebt] = useState(plan ? String(plan.debtInput || plan.debt) : "");
  const [includeCredit, setIncludeCredit] = useState(plan?.includeCredit ?? false);
  const [applyInterest, setApplyInterest] = useState(plan?.applyInterest ?? false);
  const [rate, setRate] = useState(plan?.interestRate ? String(plan.interestRate) : "");
  const [scheduleType, setScheduleType] = useState(plan?.scheduleType || "Fixed Instalment Frequency");
  const [frequency, setFrequency] = useState(plan?.frequency || "1 month");
  const [each, setEach] = useState(plan?.instalmentAmount ? String(plan.instalmentAmount) : "");
  const [manual, setManual] = useState<Array<{ date: string; amount: string }>>(plan?.manual?.length ? plan.manual.map((i) => ({ date: str(i.date), amount: String(i.amount) })) : [{ date: today(), amount: "" }]);
  const [prompts, setPrompts] = useState(plan?.prompts ?? "Disabled");
  const [notes, setNotes] = useState(plan?.notes ?? "");
  useEffect(() => {
    setCtx(null);
    if (!sid) return;
    fin<PlanCtx>(`/student/${sid}/plans`).then(setCtx).catch(() => setCtx(null));
  }, [sid]);
  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = meta.planTemplates.find((x) => x.id === id);
    if (!t) return;
    setScheduleType(t.scheduleType || "Fixed Instalment Frequency");
    if (t.frequency) setFrequency(t.frequency);
    setSync(t.balanceSync === "With term balance" ? "With term balance" : t.balanceSync === "With total balance" ? "With total fees balance" : "Disabled");
    if (t.balanceSync === "Fixed Amount" && t.fixedAmount) setDebt(String(t.fixedAmount));
    setIncludeCredit(t.offsetCredit);
    setPrompts(t.prompts ? "Enabled" : "Disabled");
  };
  const syncedDebt = useMemo(() => {
    if (!ctx || sync === "Disabled") return null;
    const base = sync === "With term balance" ? (ctx.termBalances[termId] ?? 0) : ctx.balances.debit;
    return Math.max(0, base - (includeCredit ? ctx.balances.credit : 0));
  }, [ctx, sync, termId, includeCredit]);
  const tpl = meta.planTemplates.find((x) => x.id === templateId);
  const debtValue = syncedDebt ?? Number(debt || 0);
  useEffect(() => {
    if (tpl && tpl.totalInstalments && scheduleType === "Fixed Instalment Frequency" && debtValue > 0) setEach((Math.ceil((debtValue / tpl.totalInstalments) * 100) / 100).toFixed(2));
  }, [tpl, debtValue, scheduleType]);
  const manualSum = manual.reduce((a, i) => a + Number(i.amount || 0), 0);
  return (
    <ActionModal
      title={plan ? "Edit Payment Plan" : "Create Payment Plan"}
      submitLabel="Save Payment Plan"
      wide
      disabled={!sid}
      onClose={onClose}
      onSubmit={async () => {
        const body = {
          ...(startEditable || !plan ? { startDate } : {}),
          termId,
          syncBalance: sync,
          debt: sync === "Disabled" ? num(debt) : undefined,
          includeCredit,
          applyInterest,
          interestRate: applyInterest ? num(rate) : undefined,
          scheduleType,
          frequency,
          instalmentAmount: num(each),
          instalments: manual.map((i) => ({ date: i.date, amount: num(i.amount) })),
          prompts,
          notes,
          templateId: plan ? undefined : templateId,
        };
        const out = plan ? await fin<{ message: string }>(`/plans/${plan.id}`, json("PATCH", body)) : await fin<{ message: string }>(`/student/${sid}/plans`, json("POST", body));
        onDone(out.message);
      }}
    >
      {!plan && !studentId ? <StudentStep who={who} setWho={setWho} /> : null}
      {sid ? (
        <div className="fn-grid">
          {plan && !startEditable ? (
            <dl className="fn-dl fn-span">
              <dt>Student</dt>
              <dd>{plan.student ? `${plan.student.name} (#${plan.student.number})` : "—"}</dd>
              <dt>Start Date</dt>
              <dd>{fmtDay(plan.startDate)}</dd>
            </dl>
          ) : null}
          {!plan && meta.planTemplates.length ? (
            <Field label="Payment Plan Template" hint="Optional: pre-fills the schedule and charges the template's plan fee.">
              <Select value={templateId} onChange={applyTemplate} options={meta.planTemplates} placeholder="No template" />
            </Field>
          ) : null}
          {startEditable || !plan ? (
            <Field label="Start Date" required>
              <input className="mh-sa__input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
          ) : null}
          <Field label="Term">
            <Select value={termId} onChange={setTermId} options={meta.terms} placeholder="No term" />
          </Field>
          <Field label="Synchronize Balance">
            <Select value={sync} onChange={setSync} options={meta.constants.syncOptions ?? []} />
          </Field>
          {ctx ? (
            <dl className="fn-dl fn-span fn-dl--inline">
              <dt>Debit Balance</dt>
              <dd>{money(ctx.balances.debit)}</dd>
              <dt>Credit Balance</dt>
              <dd>{money(ctx.balances.credit)}</dd>
            </dl>
          ) : null}
          <Field label="Debt Amount" required={sync === "Disabled"} hint={sync !== "Disabled" ? "Follows the synchronized balance." : undefined}>
            {sync === "Disabled" ? <input className="mh-sa__input" type="number" step="0.01" min="0" value={debt} onChange={(e) => setDebt(e.target.value)} /> : <input className="mh-sa__input" readOnly value={syncedDebt === null ? "—" : money(syncedDebt)} />}
          </Field>
          <div className="fn-checks fn-span">
            <label className="mh-sa__check">
              <input type="checkbox" checked={includeCredit} onChange={(e) => setIncludeCredit(e.target.checked)} /> Include pre-payment / credit balance
            </label>
            <label className="mh-sa__check">
              <input type="checkbox" checked={applyInterest} onChange={(e) => setApplyInterest(e.target.checked)} /> Apply Interest
            </label>
          </div>
          {applyInterest ? (
            <Field label="Annual Interest Rate (%)" required>
              <input className="mh-sa__input" type="number" step="0.01" min="0" max="60" value={rate} onChange={(e) => setRate(e.target.value)} />
            </Field>
          ) : null}
          <Field label="Schedule Type">
            <Select value={scheduleType} onChange={setScheduleType} options={meta.constants.scheduleTypes ?? []} />
          </Field>
          {scheduleType === "Fixed Instalment Frequency" ? (
            <>
              <Field label="Instalment Frequency" required>
                <Select value={frequency} onChange={setFrequency} options={meta.frequencies} />
              </Field>
              <Field label="Instalment Amount" required hint={Number(each) > 0 && debtValue > 0 ? `${Math.ceil(debtValue / Number(each))} instalment(s)` : undefined}>
                <input className="mh-sa__input" type="number" step="0.01" min="0" value={each} onChange={(e) => setEach(e.target.value)} />
              </Field>
            </>
          ) : (
            <div className="fn-span">
              <span className="mh-sa__label">Instalments</span>
              <table className="mh-sa__table fn-table fn-table--compact">
                <thead>
                  <tr>
                    <th>Due Date</th>
                    <th>Amount</th>
                    <th aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {manual.map((i, k) => (
                    <tr key={k}>
                      <td>
                        <input className="mh-sa__input" type="date" value={i.date} onChange={(e) => setManual((m) => m.map((x, j) => (j === k ? { ...x, date: e.target.value } : x)))} />
                      </td>
                      <td>
                        <input className="mh-sa__input" type="number" step="0.01" min="0" value={i.amount} onChange={(e) => setManual((m) => m.map((x, j) => (j === k ? { ...x, amount: e.target.value } : x)))} />
                      </td>
                      <td>
                        <button type="button" className="fn-x" aria-label="Remove instalment" disabled={manual.length < 2} onClick={() => setManual((m) => m.filter((_, j) => j !== k))}>
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="fn-row">
                <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setManual((m) => [...m, { date: m[m.length - 1]?.date || today(), amount: "" }])}>
                  Add Instalment
                </button>
                <span className={Math.abs(manualSum - debtValue) > 0.01 ? "fn-warn-text" : "mh-sa__muted"}>
                  Instalments total {money(manualSum)} of {money(debtValue)}
                </span>
              </div>
            </div>
          )}
          <Field label="Prompt Conditions">
            <Select value={prompts} onChange={setPrompts} options={["Disabled", "Enabled"]} />
          </Field>
          <Field label="Notes / Comments" lang wide>
            <textarea className="mh-sa__input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      ) : null}
    </ActionModal>
  );
}

export function DeletePlanModal({ plan, onClose, onDone }: { plan: PlanRow; onClose: () => void; onDone: Done }) {
  return (
    <ConfirmModal
      title="Delete Payment Plan"
      okLabel="Delete Payment Plan"
      onClose={onClose}
      body={`Delete payment plan #${plan.number} (${money(plan.debt)})? Payments already made stay on the student's account.`}
      onConfirm={async () => onDone((await fin<{ message: string }>(`/plans/${plan.id}`, { method: "DELETE" })).message)}
    />
  );
}

export function CollectionsModal({ meta, onClose, onDone, studentId, balance }: Base & { studentId: string; balance: number }) {
  const [agencyId, setAgencyId] = useState(meta.collectionAgencies.find((a) => a.isDefault)?.id ?? "");
  const [amount, setAmount] = useState(balance > 0 ? String(balance) : "");
  const [note, setNote] = useState("");
  return (
    <ActionModal title="Send to Collections" submitLabel="Send to Collections" onClose={onClose} onSubmit={async () => onDone((await fin<{ message: string }>(`/student/${studentId}/collections`, json("POST", { agencyId, amount: num(amount), note }))).message)}>
      <Field label="Collection Agency" required>
        <Select value={agencyId} onChange={setAgencyId} options={meta.collectionAgencies} placeholder="Select a Collection Agency" />
      </Field>
      <Field label="Amount Sent to Collections" required hint={`Student balance: ${money(balance)}`}>
        <input className="mh-sa__input" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Note / Comment" lang wide>
        <textarea className="mh-sa__input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </ActionModal>
  );
}

/* ------------------------------------------------------------------ */
/* Unallocated funds                                                    */
/* ------------------------------------------------------------------ */

export function FundModal({ meta, onClose, onDone, fund: initial }: Base & { fund?: FundRow }) {
  const [fund, setFund] = useState(initial);
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [received, setReceived] = useState(initial?.receivedDate ?? today());
  const [methodId, setMethodId] = useState(initial?.methodId ?? "");
  const [receipt, setReceipt] = useState(initial?.receipt ?? "");
  const [sourceId, setSourceId] = useState(initial?.fundingSourceId ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [rows, setRows] = useState<Array<{ who: Who; amount: string; typeId: string }> | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const refetch = async () => {
    if (!fund) return;
    const r = await fin<{ items: FundRow[] }>(`/funds?number=${fund.number}&perPage=100`);
    const f = r.items.find((x) => x.id === fund.id);
    if (f) setFund(f);
  };
  const allocate = () => {
    if (!fund || !rows) return;
    setBusy(true);
    setMsg(null);
    fin<{ message: string }>(`/funds/${fund.id}/allocate`, json("POST", { rows: rows.map((r) => ({ studentId: r.who?.id ?? "", amount: num(r.amount), typeId: r.typeId })) }))
      .then(async (o) => {
        setMsg({ tone: "success", text: o.message });
        setRows(null);
        await refetch();
      })
      .catch((e) => setMsg({ tone: "error", text: errMsg(e, "Could not allocate the funds") }))
      .finally(() => setBusy(false));
  };
  const unallocate = (allocId: string) => {
    if (!fund || !window.confirm("Remove this allocation? The payment or credit posted to the student is reversed.")) return;
    fin<{ message: string }>(`/funds/${fund.id}/allocations/${allocId}`, { method: "DELETE" })
      .then(async (o) => {
        setMsg({ tone: "success", text: o.message });
        await refetch();
      })
      .catch((e) => setMsg({ tone: "error", text: errMsg(e, "Could not remove the allocation") }));
  };
  return (
    <ActionModal
      title={fund ? "Edit Unallocated Fund" : "Add Unallocated Fund"}
      submitLabel="Save Fund"
      wide={Boolean(fund)}
      onClose={() => (fund && fund !== initial ? onDone("Unallocated fund updated successfully") : onClose())}
      onSubmit={async () => {
        const body = { amount: num(amount), receivedDate: received, methodId, receipt, fundingSourceId: sourceId, note };
        const out = fund ? await fin<{ message: string }>(`/funds/${fund.id}`, json("PATCH", body)) : await fin<{ message: string }>("/funds", json("POST", body));
        onDone(out.message);
      }}
    >
      {msg ? <div className={`mh-sa__notice mh-sa__notice--${msg.tone}`}>{msg.text}</div> : null}
      <div className="fn-grid">
        <Field label="Fund Amount" required>
          <input className="mh-sa__input" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Received Date" required>
          <input className="mh-sa__input" type="date" max={today()} value={received} onChange={(e) => setReceived(e.target.value)} />
        </Field>
        <Field label="Payment Method" required>
          <Select value={methodId} onChange={setMethodId} options={meta.paymentMethods} placeholder="Select a Payment Method" />
        </Field>
        <Field label="Receipt Number">
          <input className="mh-sa__input" value={receipt} onChange={(e) => setReceipt(e.target.value)} />
        </Field>
        {meta.fundingSources.length ? (
          <Field label="Funding Source">
            <Select value={sourceId} onChange={setSourceId} options={meta.fundingSources} placeholder="None" />
          </Field>
        ) : null}
        <Field label="Note / Comment" lang wide>
          <textarea className="mh-sa__input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      {fund ? (
        <section className="fn-section">
          <div className="fn-row fn-row--between">
            <h4>
              Allocations · {money(fund.allocated)} of {money(fund.amount)} allocated
            </h4>
            {!rows && fund.unallocated > 0 ? (
              <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setRows([{ who: null, amount: String(fund.unallocated), typeId: "" }])}>
                Allocate Funds
              </button>
            ) : null}
          </div>
          <table className="mh-sa__table fn-table fn-table--compact">
            <thead>
              <tr>
                <th>Student</th>
                <th>Allocated</th>
                <th>Disbursement</th>
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {fund.allocations.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.student} <small className="fn-sub">#{a.studentNumber}</small>
                  </td>
                  <td>{money(a.amount)}</td>
                  <td>{a.as}</td>
                  <td>
                    <button type="button" className="fn-x" aria-label="Remove allocation" onClick={() => unallocate(a.id)}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {!fund.allocations.length && !rows ? (
                <tr>
                  <td colSpan={4} className="mh-sa__empty-cell">
                    Nothing has been allocated from this fund yet.
                  </td>
                </tr>
              ) : null}
              {rows?.map((r, k) => (
                <tr key={`n${k}`} className="fn-newrow">
                  <td>
                    <StudentPicker value={r.who} onChange={(w) => setRows((x) => x!.map((y, j) => (j === k ? { ...y, who: w } : y)))} />
                  </td>
                  <td>
                    <input className="mh-sa__input" type="number" step="0.01" min="0" value={r.amount} onChange={(e) => setRows((x) => x!.map((y, j) => (j === k ? { ...y, amount: e.target.value } : y)))} />
                  </td>
                  <td>
                    <Select value={r.typeId} onChange={(v) => setRows((x) => x!.map((y, j) => (j === k ? { ...y, typeId: v } : y)))} options={meta.disbursementTypes} placeholder="Payment (no disbursement)" />
                  </td>
                  <td>
                    <button type="button" className="fn-x" aria-label="Remove row" onClick={() => setRows((x) => (x!.length > 1 ? x!.filter((_, j) => j !== k) : null))}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows ? (
            <div className="fn-row">
              <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setRows((x) => [...x!, { who: null, amount: "", typeId: "" }])}>
                Add Student
              </button>
              <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--primary" disabled={busy} onClick={allocate}>
                {busy ? "Allocating…" : "Allocate Funds"}
              </button>
              <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setRows(null)}>
                Cancel
              </button>
              <span className="mh-sa__muted">Unallocated: {money(fund.unallocated)}</span>
            </div>
          ) : null}
        </section>
      ) : null}
    </ActionModal>
  );
}

export function DeleteFundModal({ fund, onClose, onDone }: { fund: FundRow; onClose: () => void; onDone: Done }) {
  return (
    <ConfirmModal
      title="Delete Fund"
      okLabel="Delete Fund"
      onClose={onClose}
      body={`Delete unallocated fund #${fund.number} (${money(fund.amount)})?`}
      onConfirm={async () => onDone((await fin<{ message: string }>(`/funds/${fund.id}`, { method: "DELETE" })).message)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Invoices                                                             */
/* ------------------------------------------------------------------ */

export function CreditNotesModal({ invoice, onClose, onDone, canAdd }: { invoice: InvoiceRow; onClose: () => void; onDone: Done; canAdd: boolean }) {
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addNote = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await fin<{ message: string }>(`/invoices/${invoice.id}/credit-notes`, json("POST", { date, amount: num(amount), note }));
      onDone(out.message);
    } catch (e) {
      setError(errMsg(e, "Could not add the credit note"));
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Credit Notes: Invoice #${invoice.number}`}
      onClose={onClose}
      wide
      footer={
        canAdd && invoice.total > 0 ? (
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy || !amount || !note.trim()} onClick={() => void addNote()}>
            {busy ? "Adding…" : "Add Credit Note"}
          </button>
        ) : undefined
      }
    >
      {error ? <div className="mh-sa__notice mh-sa__notice--error">{error}</div> : null}
      {invoice.creditNotes.length ? (
        <table className="mh-sa__table fn-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Note</th>
              <th className="fn-num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.creditNotes.map((n, k) => (
              <tr key={k}>
                <td>{n.number ?? k + 1}</td>
                <td>{fmtDay(n.date)}</td>
                <td>{n.note}</td>
                <td className="fn-num">{money(n.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mh-sa__muted">No credit notes were found.</p>
      )}
      {canAdd && invoice.total > 0 ? (
        <div className="fn-grid fn-section">
          <Field label="Credit Note Date" required>
            <input className="mh-sa__input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={`Amount (maximum ${money(invoice.total)})`} required>
            <input className="mh-sa__input" type="number" min="0.01" max={invoice.total} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Credit Note" required wide>
            <textarea className="mh-sa__input" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      ) : canAdd ? <p className="mh-sa__muted">This invoice has no remaining balance to credit.</p> : null}
    </Modal>
  );
}

type Unpaid = { items: Array<{ id: string; number: number; type: string; entryDate: string; amount: number; owing: number }>; credits: Array<{ id: string; number: number; type: string; amount: number }> };

function AddItemModal({ meta, studentId, credits, onClose, onAdd }: { meta: FinMeta; studentId: string; credits: Unpaid["credits"]; onClose: () => void; onAdd: (items: InvoiceItem[]) => void }) {
  const types = studentId ? (meta.constants.itemTypes ?? []) : ["Other Fee / Ledger Item"];
  const [kind, setKind] = useState(types[0] ?? "Other Fee / Ledger Item");
  const [courses, setCourses] = useState<Array<{ id: string; label: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [availPick, setAvailPick] = useState<string[]>([]);
  const [selPick, setSelPick] = useState<string[]>([]);
  const [textbooks, setTextbooks] = useState(false);
  const [deps, setDeps] = useState(false);
  const books = meta.ledgerTypes.find((t) => t.trigger === "Textbooks");
  const [typeId, setTypeId] = useState(kind === "Textbook" ? (books?.id ?? "") : "");
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("1");
  const [fee, setFee] = useState("");
  const [creditId, setCreditId] = useState("");
  useEffect(() => {
    if (kind === "Course" && !courses.length) fin<Array<{ id: string; label: string }>>("/courses").then(setCourses).catch(() => setCourses([]));
    if (kind === "Textbook" && books) {
      setTypeId(books.id);
      setDesc(books.name);
      setFee(String(books.domestic));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
  const pickType = (id: string) => {
    setTypeId(id);
    const t = meta.ledgerTypes.find((x) => x.id === id);
    if (t) {
      setDesc(t.name);
      setFee(String(t.domestic));
    }
  };
  const id = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `i${Date.now()}${Math.random()}`);
  return (
    <ActionModal
      title="Add Invoice Item"
      submitLabel="Save Invoice Item"
      onClose={onClose}
      onSubmit={async () => {
        if (kind === "Course") {
          if (!selected.length) throw new Error("Select at least one course");
          const r = await fin<{ items: InvoiceItem[] }>(`/student/${studentId}/course-items`, json("POST", { courseIds: selected, textbooks, dependencies: deps }));
          onAdd(r.items);
          return;
        }
        if (kind === "Credit / Disbursement") {
          const c = credits.find((x) => x.id === creditId);
          if (!c) throw new Error("Select a credit / disbursement");
          onAdd([{ id: id(), kind: "credit", refId: c.id, ledgerTypeId: "", quantity: 1, description: `Credit #${c.number}: ${c.type}`, fee: c.amount, total: -c.amount }]);
          return;
        }
        const q = Number(qty);
        const f = Number(fee);
        if (!desc.trim()) throw new Error("Description is required");
        if (!(f >= 0)) throw new Error("Fee must be zero or more");
        if (!typeId) throw new Error("Choose a Tuition / Ledger Type");
        onAdd([{ id: id(), kind: kind === "Textbook" ? "textbook" : "other", refId: "", ledgerTypeId: typeId, quantity: q, description: desc.trim(), fee: f, total: Math.round(f * q * 100) / 100 }]);
      }}
    >
      <Field label="Item Type">
        <Select value={kind} onChange={setKind} options={types} />
      </Field>
      {kind === "Course" ? (
        <>
          <div className="fn-checks">
            <label className="mh-sa__check">
              <input type="checkbox" checked={textbooks} onChange={(e) => setTextbooks(e.target.checked)} /> Add Course Textbooks to Invoice
            </label>
            <label className="mh-sa__check">
              <input type="checkbox" checked={deps} onChange={(e) => setDeps(e.target.checked)} /> Add Course Fee Dependencies to Invoice
            </label>
          </div>
          <div className="fn-dual">
            <label className="mh-sa__field">
              <span className="mh-sa__label">Available Courses</span>
              <select multiple size={8} className="mh-sa__input" value={availPick} onChange={(e) => setAvailPick(Array.from(e.target.selectedOptions).map((o) => o.value))}>
                {courses
                  .filter((c) => !selected.includes(c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
              </select>
            </label>
            <div className="fn-dual__btns">
              <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => (setSelected((s) => [...s, ...availPick]), setAvailPick([]))}>
                Add
              </button>
              <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => (setSelected((s) => s.filter((x) => !selPick.includes(x))), setSelPick([]))}>
                Remove
              </button>
            </div>
            <label className="mh-sa__field">
              <span className="mh-sa__label">Selected Courses</span>
              <select multiple size={8} className="mh-sa__input" value={selPick} onChange={(e) => setSelPick(Array.from(e.target.selectedOptions).map((o) => o.value))}>
                {selected.map((sid) => (
                  <option key={sid} value={sid}>
                    {courses.find((c) => c.id === sid)?.label ?? sid}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      ) : kind === "Credit / Disbursement" ? (
        <Field label="Credit / Disbursement" required>
          {credits.length ? <Select value={creditId} onChange={setCreditId} options={credits.map((c) => ({ id: c.id, name: `#${c.number} ${c.type} (${money(c.amount)})` }))} placeholder="Select a credit / disbursement" /> : <p className="mh-sa__muted">The student has no active credits or disbursements.</p>}
        </Field>
      ) : (
        <>
          <Field label="Tuition / Ledger Type" required>
            <Select value={typeId} onChange={pickType} options={meta.ledgerTypes} placeholder="Select a Tuition / Ledger Type" />
          </Field>
          <Field label="Description" required lang>
            <input className="mh-sa__input" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <Field label="Quantity">
            <Select value={qty} onChange={setQty} options={QTY} />
          </Field>
          <Field label="Fee" required>
            <input className="mh-sa__input" type="number" step="0.01" min="0" value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
        </>
      )}
    </ActionModal>
  );
}

export function InvoiceEditor({ meta, onClose, onDone, invoiceId, studentId, student }: Base & { invoiceId?: string; studentId?: string; student?: Who }) {
  const [loaded, setLoaded] = useState<InvoiceRow | null>(null);
  const [type, setType] = useState("Student");
  const [who, setWho] = useState<Who>(student ?? null);
  const [agentId, setAgentId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [due, setDue] = useState("");
  const [termId, setTermId] = useState("");
  const [template, setTemplate] = useState(meta.constants.invoiceTemplates?.[0] ?? "Invoice Template");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [stage, setStage] = useState<"pick" | "items">("pick");
  const [unpaid, setUnpaid] = useState<Unpaid | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [addingStudentFee, setAddingStudentFee] = useState(false);
  const [generate, setGenerate] = useState(false);
  const [send, setSend] = useState("Do not send");
  const [note, setNote] = useState("");
  const sid = loaded?.studentId || who?.id || studentId || "";
  useEffect(() => {
    if (!invoiceId) return;
    fin<InvoiceRow>(`/invoices/${invoiceId}`).then((r) => {
      setLoaded(r);
      setType(r.type);
      setAgentId(r.agentId);
      setSourceId(r.fundingSourceId);
      setDue(r.dueDate);
      setTermId(r.termId);
      setTemplate(r.template);
      setItems(r.items);
      setNote(r.note);
      setStage("items");
    });
  }, [invoiceId]);
  useEffect(() => {
    if (invoiceId || type !== "Student" || !sid || !termId) return;
    setUnpaid(null);
    fin<Unpaid>(`/student/${sid}/unpaid-fees?term=${encodeURIComponent(termId)}`)
      .then((u) => {
        setUnpaid(u);
        setChecked([]);
        if (!u.items.length) setStage("items");
      })
      .catch(() => setUnpaid({ items: [], credits: [] }));
  }, [invoiceId, type, sid, termId]);
  useEffect(() => {
    if (!invoiceId && type === "Student" && sid && termId && !items.length) setStage("pick");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, termId]);
  const ready = type === "Student" ? Boolean(sid && termId) : type === "Agent" ? Boolean(agentId) : Boolean(sourceId);
  const paidOf = (i: InvoiceItem) => {
    const u = unpaid?.items.find((x) => x.id === i.refId);
    return u ? Math.round((u.amount - u.owing) * 100) / 100 : 0;
  };
  const subtotal = items.reduce((a, i) => a + (i.kind === "credit" ? -Math.abs(i.fee * i.quantity) : i.total), 0);
  const payments = loaded ? loaded.totalPayments : items.reduce((a, i) => a + paidOf(i), 0);
  const adjustments = loaded?.adjustments ?? 0;
  const addFees = () => {
    const picked = (unpaid?.items ?? []).filter((f) => checked.includes(f.id) && !items.some((i) => i.refId === f.id));
    setItems((cur) => [...cur, ...picked.map((f) => ({ id: `fee-${f.id}`, kind: "fee", refId: f.id, ledgerTypeId: "", quantity: 1, description: `#${f.number} ${f.type}`, fee: f.amount, total: f.amount }))]);
    setStage("items");
  };
  const sendOptions = (meta.constants.sendOptions ?? []).filter((o) => (type === "Student" ? !/funding/.test(o) : type === "Agent" ? o === "Do not send" || o === "Send to agent" : o === "Do not send" || /funding/.test(o)));
  const heading = invoiceId ? `Edit Invoice #${loaded?.number ?? ""}` : "Create Invoice";
  return (
    <>
      <ActionModal
        title={heading}
        submitLabel="Save Invoice"
        wide
        disabled={!ready || stage !== "items" || !items.length || (Boolean(invoiceId) && !loaded)}
        onClose={onClose}
        onSubmit={async () => {
          const body = { type, studentId: sid, agentId, fundingSourceId: sourceId, dueDate: due, termId, template, items, note, generateDocument: generate, send };
          const out = invoiceId ? await fin<{ message: string }>(`/invoices/${invoiceId}`, json("PATCH", body)) : await fin<{ id: string; message: string }>("/invoices", json("POST", body));
          const newId = invoiceId ?? (out as { id?: string }).id;
          if (generate && newId) await downloadPdf(`/invoices/${newId}/pdf`).catch(() => undefined);
          onDone(out.message);
        }}
      >
        {invoiceId && !loaded ? <p className="mh-sa__muted">Loading invoice…</p> : null}
        <h4 className="fn-h">Invoice Details</h4>
        <div className="fn-grid">
          {!invoiceId && !studentId ? (
            <Field label="Invoice Type">
              <Select value={type} onChange={(v) => (setType(v), setItems([]), setStage(v === "Student" ? "pick" : "items"))} options={meta.constants.invoiceTypes ?? []} />
            </Field>
          ) : null}
          {type === "Student" ? (
            <Field label="Student" required>
              {loaded ? (
                <span className="fn-token fn-token--static">
                  {loaded.student?.name} <small>#{loaded.student?.number}</small>
                </span>
              ) : (
                <StudentPicker value={who} onChange={(w) => (setWho(w), setItems([]))} />
              )}
            </Field>
          ) : type === "Agent" ? (
            <Field label="Agent" required>
              {loaded ? <span className="fn-token fn-token--static">{loaded.agent}</span> : <AgentPicker meta={meta} value={agentId} onChange={setAgentId} />}
            </Field>
          ) : (
            <Field label="Funding Source" required>
              {meta.fundingSources.length ? (
                <Select value={sourceId} onChange={setSourceId} options={meta.fundingSources} placeholder="Select a Funding Source" disabled={Boolean(loaded)} />
              ) : (
                <div className="mh-sa__notice mh-sa__notice--warning fn-warning">
                  No active funding sources are configured. <a href={`${FIN}/funding-sources/new`}>Add Funding Source</a>
                </div>
              )}
            </Field>
          )}
          <Field label="Due Date" required>
            <input className="mh-sa__input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="Term" required={type === "Student"}>
            <Select value={termId} onChange={(v) => (setTermId(v), invoiceId ? null : setItems([]))} options={meta.terms} placeholder="Select a Term" />
          </Field>
          <Field label="Invoice Template">
            <Select value={template} onChange={setTemplate} options={meta.constants.invoiceTemplates ?? []} />
          </Field>
        </div>
        {!ready ? (
          <div className="mh-sa__notice fn-info">{type === "Student" ? "Please select a student and term to continue" : `Please select ${type === "Agent" ? "an agent" : "a funding source"} to continue`}</div>
        ) : stage === "pick" && type === "Student" ? (
          unpaid ? (
            <section className="fn-section">
              <p>The following unpaid fees have not been added to an invoice yet. Select the fees to invoice, or build the invoice manually.</p>
              <table className="mh-sa__table fn-table fn-table--compact">
                <thead>
                  <tr>
                    <th className="fn-check">
                      <input type="checkbox" aria-label="Select all fees" checked={unpaid.items.length > 0 && checked.length === unpaid.items.length} onChange={(e) => setChecked(e.target.checked ? unpaid.items.map((f) => f.id) : [])} />
                    </th>
                    <th>Unpaid Fees</th>
                    <th>Entry Date</th>
                    <th className="fn-num">Amount</th>
                    <th className="fn-num">Owing</th>
                  </tr>
                </thead>
                <tbody>
                  {unpaid.items.map((f) => (
                    <tr key={f.id}>
                      <td className="fn-check">
                        <input type="checkbox" aria-label={`Select fee ${f.number}`} checked={checked.includes(f.id)} onChange={(e) => setChecked((c) => (e.target.checked ? [...c, f.id] : c.filter((x) => x !== f.id)))} />
                      </td>
                      <td>
                        #{f.number} {f.type}
                      </td>
                      <td>{fmtDay(f.entryDate)}</td>
                      <td className="fn-num">{money(f.amount)}</td>
                      <td className="fn-num">{money(f.owing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="fn-row">
                <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={!checked.length} onClick={addFees}>
                  Add to Invoice
                </button>
                <button type="button" className="mh-sa__btn" onClick={() => setStage("items")}>
                  Manual Invoice »
                </button>
              </div>
            </section>
          ) : (
            <p className="mh-sa__muted">Loading unpaid fees…</p>
          )
        ) : (
          <>
            <table className="mh-sa__table fn-table fn-table--compact">
              <thead>
                <tr>
                  <th>Quantity</th>
                  <th>Description</th>
                  <th className="fn-num">Fee</th>
                  <th className="fn-num">Total</th>
                  <th aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.quantity}</td>
                    <td>
                      {i.description}
                      {i.status ? <small className="fn-sub">{i.status}</small> : null}
                    </td>
                    <td className="fn-num">{money(i.kind === "credit" ? -i.fee : i.fee)}</td>
                    <td className="fn-num">{money(i.kind === "credit" ? -Math.abs(i.fee * i.quantity) : i.total)}</td>
                    <td>
                      <button type="button" className="fn-x" aria-label={`Remove ${i.description}`} onClick={() => setItems((x) => x.filter((y) => y.id !== i.id))}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                {!items.length ? (
                  <tr>
                    <td colSpan={5} className="mh-sa__empty-cell">
                      No items yet. Select an unpaid fee or use Add Item to build the invoice.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="fn-row fn-row--between">
              <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setAdding(true)}>
                Add Item
              </button>
              {type === "Student" && sid ? (
                <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setAddingStudentFee(true)}>
                  Add Fee to Student
                </button>
              ) : null}
              <dl className="fn-totals">
                <dt>Subtotal</dt>
                <dd>{money(subtotal)}</dd>
                <dt>Total Payments</dt>
                <dd>{money(payments)}</dd>
                {adjustments ? (
                  <>
                    <dt>Adjustments</dt>
                    <dd>{money(adjustments)}</dd>
                  </>
                ) : null}
                <dt>Total</dt>
                <dd>
                  <strong>{money(subtotal - payments - adjustments)}</strong>
                </dd>
              </dl>
            </div>
            <h4 className="fn-h">Complete / Send Invoice</h4>
            <div className="fn-grid">
              <label className="mh-sa__check fn-span">
                <input type="checkbox" checked={generate} onChange={(e) => setGenerate(e.target.checked)} /> Generate new invoice document
              </label>
              <Field label="Send Invoice">
                <Select value={send} onChange={setSend} options={sendOptions} />
              </Field>
              <Field label="Note / Comment" lang wide>
                <textarea className="mh-sa__input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
            {invoiceId ? (
              <button type="button" className="fn-link" onClick={() => downloadPdf(`/invoices/${invoiceId}/pdf`).catch(() => undefined)}>
                Download current invoice document (PDF)
              </button>
            ) : null}
          </>
        )}
      </ActionModal>
      {adding ? <AddItemModal meta={meta} studentId={type === "Student" ? sid : ""} credits={unpaid?.credits ?? []} onClose={() => setAdding(false)} onAdd={(list) => (setItems((x) => [...x, ...list]), setAdding(false))} /> : null}
      {addingStudentFee && sid ? (
        <AddFeeModal
          meta={meta}
          studentId={sid}
          onClose={() => setAddingStudentFee(false)}
          onDone={(_message, fee) => {
            setAddingStudentFee(false);
            if (termId) {
              fin<Unpaid>(`/student/${sid}/unpaid-fees?term=${encodeURIComponent(termId)}`)
                .then((next) => {
                  setUnpaid(next);
                  setChecked([]);
                  const added = fee ? next.items.find((item) => item.id === fee.id) : undefined;
                  if (added) {
                    setItems((current) => [
                      ...current,
                      {
                        id: `fee-${added.id}`,
                        kind: "fee",
                        refId: added.id,
                        ledgerTypeId: "",
                        quantity: 1,
                        description: `#${added.number} ${added.type}`,
                        fee: added.amount,
                        total: added.amount,
                      },
                    ]);
                  }
                  setStage("items");
                })
                .catch(() => undefined);
            }
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Documents / Tax Forms                                                */
/* ------------------------------------------------------------------ */

export function DocumentsPanel({ meta, studentId }: { meta: FinMeta; studentId?: string }) {
  const [doc, setDoc] = useState("");
  const [who, setWho] = useState<Who>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const groups = meta.documents.filter((g) => studentId || g.items.every((i) => i.id !== "statement"));
  const sid = studentId ?? who?.id ?? "";
  const label = meta.documents.flatMap((g) => g.items).find((i) => i.id === doc)?.label ?? "";
  return (
    <section className="mh-sa__card">
      <h3 className="fn-h">Generate Documents / Tax Forms</h3>
      {msg ? <div className={`mh-sa__notice mh-sa__notice--${msg.tone}`}>{msg.text}</div> : null}
      <div className="fn-grid">
        <Field label="Document / Tax Form">
          <select className="mh-sa__input" value={doc} onChange={(e) => (setDoc(e.target.value), setMsg(null))}>
            <option value="">Select a Document / Tax Form</option>
            {groups.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        {doc && !studentId ? (
          <Field label="Student" hint="Leave empty to generate slips for every student who paid eligible tuition that year.">
            <StudentPicker value={who} onChange={setWho} />
          </Field>
        ) : null}
      </div>
      {doc ? (
        <div className="fn-row">
          <button
            type="button"
            className="mh-sa__btn mh-sa__btn--primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setMsg(null);
              downloadPdf("/documents", json("POST", { document: doc, studentId: sid }))
                .then(() => setMsg({ tone: "success", text: `${label} generated successfully` }))
                .catch((e) => setMsg({ tone: "error", text: errMsg(e, "Could not generate the document") }))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Generating…" : "Generate Document"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Agent, audit                                                         */
/* ------------------------------------------------------------------ */

export function ManageAgentModal({ meta, onClose, onDone, studentId }: Base & { studentId: string }) {
  const [state, setState] = useState<{ agentId: string; options: Array<{ id: string; label: string }> } | null>(null);
  const [denied, setDenied] = useState<string | null>(meta.perms.agents ? null : "You do not have the appropriate permissions to view this page.");
  const [agentId, setAgentId] = useState("");
  useEffect(() => {
    if (denied) return;
    fin<{ agentId: string; options: Array<{ id: string; label: string }> }>(`/student/${studentId}/agent`)
      .then((r) => {
        setState(r);
        setAgentId(r.agentId);
      })
      .catch((e) => setDenied(errMsg(e, "You do not have the appropriate permissions to view this page.")));
  }, [studentId, denied]);
  if (denied)
    return (
      <Modal title="Manage Agent" onClose={onClose}>
        <p className="fn-denied">{denied}</p>
      </Modal>
    );
  return (
    <ActionModal title="Manage Agent" submitLabel="Save Agent" disabled={!state} onClose={onClose} onSubmit={async () => onDone((await fin<{ message: string }>(`/student/${studentId}/agent`, json("PUT", { agentId }))).message)}>
      {state ? (
        <Field label="Assigned Agent">
          <Select value={agentId} onChange={setAgentId} options={state.options.map((o) => ({ id: o.id, name: o.label }))} placeholder="No agent" />
        </Field>
      ) : (
        <p className="mh-sa__muted">Loading…</p>
      )}
    </ActionModal>
  );
}

const human = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export function AuditDetailModal({ item, onClose }: { item: { at: string; by: string; action: string; record: string; details: Record<string, unknown> }; onClose: () => void }) {
  const entries = Object.entries(item.details).filter(([, v]) => v !== "" && v !== null && v !== undefined);
  return (
    <Modal title={item.action} onClose={onClose}>
      <dl className="fn-dl">
        <dt>Date</dt>
        <dd>{new Date(item.at).toLocaleString("en-CA")}</dd>
        <dt>By</dt>
        <dd>{item.by}</dd>
        <dt>Record</dt>
        <dd>{item.record || "—"}</dd>
        {entries.map(([k, v]) => (
          <FragmentRow key={k} label={human(k)} value={typeof v === "object" ? JSON.stringify(v) : String(v)} />
        ))}
      </dl>
      {!entries.length ? <p className="mh-sa__muted">No further details were stored for this event.</p> : null}
    </Modal>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

export { Badge, Money };
