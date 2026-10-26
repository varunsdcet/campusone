"use client";

import { useMemo, useState } from "react";
import {
  Btn,
  Card,
  Check,
  ConfirmModal,
  Empty,
  ErrorLine,
  F,
  Filters,
  Grid,
  LinkBtn,
  Modal,
  PagerFor,
  Sel,
  SourceNotice,
  Table,
  Txt,
  downloadBase64,
  errMsg,
  fmtDate,
  fmtStamp,
  money,
  qs,
  send,
  stu,
  today,
  useLoad,
  usePaging,
  useSubmit,
  type Paged,
} from "./kit";
import { useProfile } from "./Profile";
import { AuditDetail, type AuditItem } from "./ProfileStatus";

const enc = encodeURIComponent;
type Term = { id: string; name: string };

/* ------------------------------------------------------------------ */
/* Financial Overview                                                   */
/* ------------------------------------------------------------------ */

type LedgerRow = { id: string; number: string; type: string; ledgerTypeId: string; status: string; entryDate: string; postingDate: string; amount: number; paid: number; owing: number; quantity: number; unitAmount: number; termId: string; term: string; note: string };
type Overview = {
  totals: Record<string, number>;
  agent: string;
  ledger: LedgerRow[];
  unpaidFees: LedgerRow[];
  options: { ledgerTypes: Array<{ id: string; name: string; amount: number; overridable: boolean }>; terms: Term[]; paymentMethods: string[]; paymentStatuses: string[]; paymentTypes: string[]; payees: string[] };
};

function Total({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="st-total">
      <span>{label}</span>
      <strong>{money(value)}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function AddFeeModal({ o, onClose, onSaved }: { o: Overview["options"]; onClose: () => void; onSaved: (m: string) => void }) {
  const { id } = useProfile();
  const [f, setF] = useState({ ledgerTypeId: "", amount: "", quantity: "1", termId: "", paymentStatus: o.paymentStatuses[0] ?? "", note: "" });
  const { busy, error, setError, run } = useSubmit();
  const type = o.ledgerTypes.find((t) => t.id === f.ledgerTypeId);
  const save = async () => {
    if (!f.ledgerTypeId) return setError("Tuition / Ledger Type is required");
    const out = await run(() => send<{ message: string }>(`/${enc(id)}/finance/fees`, "POST", { ...f, amount: f.amount === "" ? undefined : Number(f.amount), quantity: Number(f.quantity) }));
    if (out) onSaved(out.message || "Fee added successfully");
  };
  return (
    <Modal title="Add Fee" onClose={onClose} footer={<Btn tone="primary" disabled={busy} onClick={() => void save()}>Save Fee</Btn>}>
      <ErrorLine>{error}</ErrorLine>
      <Grid>
        <F label="Tuition / Ledger Type" req>
          <Sel
            value={f.ledgerTypeId}
            onChange={(v) => {
              const t = o.ledgerTypes.find((x) => x.id === v);
              setF((s) => ({ ...s, ledgerTypeId: v, amount: t ? String(t.amount) : "" }));
            }}
            empty="— Select —"
            options={o.ledgerTypes.map((t) => ({ value: t.id, label: t.name }))}
          />
        </F>
        <F label="Fee Amount" hint={type && !type.overridable ? "This ledger type uses its configured amount" : undefined}>
          <Txt type="number" value={f.amount} onChange={(v) => setF((s) => ({ ...s, amount: v }))} />
        </F>
        <F label="Quantity">
          <Txt type="number" value={f.quantity} onChange={(v) => setF((s) => ({ ...s, quantity: v }))} />
        </F>
        <F label="Apply to Term">
          <Sel value={f.termId} onChange={(v) => setF((s) => ({ ...s, termId: v }))} empty="— None —" options={o.terms.map((t) => ({ value: t.id, label: t.name }))} />
        </F>
        <F label="Payment Status">
          <Sel value={f.paymentStatus} onChange={(v) => setF((s) => ({ ...s, paymentStatus: v }))} options={o.paymentStatuses} />
        </F>
        <F label="Fee Note / Comment" wide>
          <textarea className="mh-sa__input" rows={3} value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} />
        </F>
      </Grid>
    </Modal>
  );
}

function EditFeeModal({ fee, terms, onClose, onSaved }: { fee: LedgerRow; terms: Term[]; onClose: () => void; onSaved: (m: string) => void }) {
  const { id } = useProfile();
  const [f, setF] = useState({ amount: String(fee.unitAmount), quantity: String(fee.quantity), termId: fee.termId, note: fee.note });
  const { busy, error, run } = useSubmit();
  const save = async () => {
    const out = await run(() => send<{ message: string }>(`/${enc(id)}/finance/fees/${enc(fee.id)}`, "PUT", { amount: Number(f.amount), quantity: Number(f.quantity), termId: f.termId, note: f.note }));
    if (out) onSaved(out.message || "Fee updated successfully");
  };
  return (
    <Modal title={`Edit Fee: ${fee.type}`} onClose={onClose} footer={<Btn tone="primary" disabled={busy} onClick={() => void save()}>Save Fee</Btn>}>
      <ErrorLine>{error}</ErrorLine>
      <Grid>
        <F label="Fee Amount">
          <Txt type="number" value={f.amount} onChange={(v) => setF((s) => ({ ...s, amount: v }))} />
        </F>
        <F label="Quantity">
          <Txt type="number" value={f.quantity} onChange={(v) => setF((s) => ({ ...s, quantity: v }))} />
        </F>
        <F label="Apply to Term">
          <Sel value={f.termId} onChange={(v) => setF((s) => ({ ...s, termId: v }))} empty="— None —" options={terms.map((t) => ({ value: t.id, label: t.name }))} />
        </F>
        <F label="Fee Note / Comment" wide>
          <textarea className="mh-sa__input" rows={3} value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} />
        </F>
      </Grid>
    </Modal>
  );
}

function PaymentModal({ o, onClose, onSaved }: { o: Overview["options"]; onClose: () => void; onSaved: (m: string) => void }) {
  const { id } = useProfile();
  const [f, setF] = useState({ amount: "", date: today(), payee: o.payees[0] ?? "Student", paymentType: o.paymentTypes[0] ?? "Standard", method: "", note: "", autoApply: true });
  const { busy, error, setError, run } = useSubmit();
  const save = async () => {
    const missing = [!f.amount && "Payment Amount", !f.date && "Payment Date", !f.method && "Payment Method"].filter(Boolean);
    if (missing.length) return setError(`Please complete: ${missing.join(", ")}`);
    const out = await run(() => send<{ message: string }>(`/${enc(id)}/finance/payments`, "POST", { ...f, amount: Number(f.amount) }));
    if (out) onSaved(out.message || "Payment applied successfully");
  };
  return (
    <Modal title="Apply New Payment" onClose={onClose} footer={<Btn tone="primary" disabled={busy} onClick={() => void save()}>APPLY PAYMENT</Btn>}>
      <ErrorLine>{error}</ErrorLine>
      <Grid>
        <F label="Payment Amount" req>
          <Txt type="number" value={f.amount} onChange={(v) => setF((s) => ({ ...s, amount: v }))} />
        </F>
        <F label="Payment Date" req>
          <Txt type="date" value={f.date} onChange={(v) => setF((s) => ({ ...s, date: v }))} />
        </F>
        <F label="Payee">
          <Sel value={f.payee} onChange={(v) => setF((s) => ({ ...s, payee: v }))} options={o.payees} />
        </F>
        <F label="Payment Type">
          <Sel value={f.paymentType} onChange={(v) => setF((s) => ({ ...s, paymentType: v }))} options={o.paymentTypes} />
        </F>
        <F label="Payment Method" req>
          <Sel value={f.method} onChange={(v) => setF((s) => ({ ...s, method: v }))} empty={o.paymentMethods.length ? "— Select —" : "No payment methods configured"} options={o.paymentMethods} />
        </F>
        <F label="Note" wide>
          <textarea className="mh-sa__input" rows={2} value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} />
        </F>
      </Grid>
      <div className="lx-checks" style={{ marginTop: 8 }}>
        <Check checked={f.autoApply} onChange={(v) => setF((s) => ({ ...s, autoApply: v }))}>
          Automatically apply payment to outstanding balances
        </Check>
      </div>
    </Modal>
  );
}

function AgentModal({ onClose, onSaved }: { onClose: () => void; onSaved: (m: string) => void }) {
  const { id } = useProfile();
  const { data, error } = useLoad<{ agentId: string; agents: Array<{ id: string; name: string }> }>(`/${enc(id)}/finance/agent`);
  const [agentId, setAgentId] = useState<string | null>(null);
  const { busy, error: saveError, run } = useSubmit();
  const value = agentId ?? data?.agentId ?? "";
  return (
    <Modal
      title="Manage Agent"
      onClose={onClose}
      footer={
        data ? (
          <Btn tone="primary" disabled={busy} onClick={async () => { const out = await run(() => send<{ message: string }>(`/${enc(id)}/finance/agent`, "PUT", { agentId: value })); if (out) onSaved(out.message); }}>
            Save Agent
          </Btn>
        ) : (
          <Btn onClick={onClose}>Close</Btn>
        )
      }
    >
      <ErrorLine>{error ?? saveError}</ErrorLine>
      {data ? (
        <F label="Agent">
          <Sel value={value} onChange={setAgentId} empty="— No agent —" options={data.agents.map((a) => ({ value: a.id, label: a.name }))} />
        </F>
      ) : !error ? (
        <Empty>Loading…</Empty>
      ) : null}
    </Modal>
  );
}

export function FinancialOverview() {
  const { id, notice } = useProfile();
  const [filter, setFilter] = useState({ ledgerType: "", term: "" });
  const { data, error, reload } = useLoad<Overview>(`/${enc(id)}/finance/overview${qs(filter)}`);
  const [modal, setModal] = useState<"fee" | "payment" | "agent" | null>(null);
  const [editing, setEditing] = useState<LedgerRow | null>(null);
  const [removing, setRemoving] = useState<LedgerRow | null>(null);
  const done = (m: string) => {
    setModal(null);
    setEditing(null);
    notice.ok(m);
    reload();
  };
  if (!data) return error ? <ErrorLine>{error}</ErrorLine> : <Empty>Loading…</Empty>;
  const t = data.totals;
  return (
    <>
      <Card
        title="Financial Overview"
        actions={
          <Btn small tone="primary" onClick={() => setModal("payment")}>
            Apply New Payment
          </Btn>
        }
      >
        <div className="st-totals">
          <Total label="Tuition Owing" value={t.tuitionOwing ?? 0} sub={`Paid ${money(t.tuitionPaid)} of ${money(t.tuitionTotal)}`} />
          <Total label="Fees Owing" value={t.feesOwing ?? 0} sub={`Paid ${money(t.feesPaid)} of ${money(t.feesTotal)}`} />
          <Total label="Total Payments" value={t.totalPayments ?? 0} />
          <Total label="Total Credit" value={t.totalCredit ?? 0} />
          <Total label="Total Refunds" value={t.totalRefunds ?? 0} />
          <Total label="Student Balance" value={t.balance ?? 0} />
          <Total label="Funds / Disbursements Allocated" value={t.fundsAllocated ?? 0} sub={`Remaining ${money(t.fundsRemaining)}`} />
          <Total label="Promotions / Awards Allocated" value={t.awardsAllocated ?? 0} sub={`Remaining ${money(t.awardsRemaining)}`} />
          <div className="st-total">
            <span>
              Agent Commission{" "}
              <button type="button" className="st-link" title="Manage Agent" aria-label="Manage Agent" onClick={() => setModal("agent")}>
                👤
              </button>
            </span>
            <strong>{money(t.commissionEarned)}</strong>
            <small>
              Earned · Expected {money(t.commissionExpected)}
              {data.agent ? ` · ${data.agent}` : " · No agent"}
            </small>
          </div>
        </div>
      </Card>
      <Card
        title="Ledger"
        actions={
          <Btn small tone="primary" onClick={() => setModal("fee")}>
            Add Fee
          </Btn>
        }
      >
        <div className="st-filters__grid" style={{ marginBottom: 10 }}>
          <F label="Ledger Type">
            <Sel value={filter.ledgerType} onChange={(v) => setFilter((s) => ({ ...s, ledgerType: v }))} empty="All Ledger Types" options={data.options.ledgerTypes.map((x) => ({ value: x.id, label: x.name }))} />
          </F>
          {data.ledger.length || filter.term ? (
            <F label="Term">
              <Sel value={filter.term} onChange={(v) => setFilter((s) => ({ ...s, term: v }))} empty="All Terms" options={data.options.terms.map((x) => ({ value: x.id, label: x.name }))} />
            </F>
          ) : null}
        </div>
        <Table head={["#", "Tuition / Ledger Type", "Status", "Entry Date", "Posting Date", "Amount", "Paid", ""]} empty="No ledger entries were found.">
          {data.ledger.map((r) => (
            <tr key={r.id}>
              <td>{r.number}</td>
              <td>
                {r.type}
                {r.term ? <div className="mh-sa__muted" style={{ fontSize: 12 }}>{r.term}</div> : null}
              </td>
              <td>{r.status}</td>
              <td>{fmtDate(r.entryDate)}</td>
              <td>{fmtDate(r.postingDate)}</td>
              <td>{money(r.amount)}</td>
              <td>{money(r.paid)}</td>
              <td className="st-right">
                <span className="st-actions">
                  <LinkBtn onClick={() => setEditing(r)}>Update</LinkBtn>
                  <LinkBtn danger onClick={() => setRemoving(r)}>
                    Remove
                  </LinkBtn>
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      {modal === "fee" ? <AddFeeModal o={data.options} onClose={() => setModal(null)} onSaved={done} /> : null}
      {modal === "payment" ? <PaymentModal o={data.options} onClose={() => setModal(null)} onSaved={done} /> : null}
      {modal === "agent" ? <AgentModal onClose={() => setModal(null)} onSaved={done} /> : null}
      {editing ? <EditFeeModal fee={editing} terms={data.options.terms} onClose={() => setEditing(null)} onSaved={done} /> : null}
      {removing ? (
        <ConfirmModal
          title="Delete Fee"
          body={`Delete fee #${removing.number} (${removing.type}, ${money(removing.amount)})?`}
          ok="Confirm Delete Fee"
          onCancel={() => setRemoving(null)}
          onOk={async () => {
            try {
              const out = await send<{ message: string }>(`/${enc(id)}/finance/fees/${enc(removing.id)}`, "DELETE");
              done(out.message || "Fee removed successfully");
            } catch (e) {
              notice.fail(errMsg(e, "Could not remove fee"));
            }
            setRemoving(null);
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Financial Transactions                                               */
/* ------------------------------------------------------------------ */

type Txn = { id: string; number: string; kind: string; fundSource: string; entryDate: string; recordedDate: string; status: string; type: string; amount: number; balance: number; refundable: number; receipt: boolean };
type TxnList = Paged<Txn> & { refundable: number; options: { refundTypes: string[]; methods: string[] } };

function RefundModal({ txn, list, onClose, onSaved }: { txn: Txn | null; list: TxnList; onClose: () => void; onSaved: (m: string) => void }) {
  const { id } = useProfile();
  const max = txn ? txn.refundable : list.refundable;
  const [f, setF] = useState({ refundType: list.options.refundTypes[0] ?? "Cash Back", method: list.options.methods[0] ?? "", amount: String(max), date: today(), note: "" });
  const { busy, error, run } = useSubmit();
  const save = async () => {
    const out = await run(() => send<{ message: string }>(`/${enc(id)}/finance/refunds`, "POST", { ...f, amount: Number(f.amount), ...(txn ? { entryId: txn.id } : {}) }));
    if (out) onSaved(out.message || "Refund issued");
  };
  return (
    <Modal title={txn ? `Refund Payment #${txn.number}` : "Refund Payment"} onClose={onClose} footer={<Btn tone="primary" disabled={busy} onClick={() => void save()}>Issue Refund</Btn>}>
      <ErrorLine>{error}</ErrorLine>
      <p className="mh-sa__muted pm-note" style={{ marginTop: 0 }}>
        Refundable: {money(max)}
      </p>
      <Grid>
        <F label="Refund Type">
          <Sel value={f.refundType} onChange={(v) => setF((s) => ({ ...s, refundType: v }))} options={list.options.refundTypes} />
        </F>
        {f.refundType === "Cash Back" ? (
          <F label="Refund Method">
            <Sel value={f.method} onChange={(v) => setF((s) => ({ ...s, method: v }))} options={list.options.methods} />
          </F>
        ) : null}
        <F label="Refund Amount">
          <Txt type="number" value={f.amount} onChange={(v) => setF((s) => ({ ...s, amount: v }))} />
        </F>
        <F label="Refund Date">
          <Txt type="date" value={f.date} onChange={(v) => setF((s) => ({ ...s, date: v }))} />
        </F>
        <F label="Note / Comment" wide>
          <textarea className="mh-sa__input" rows={2} value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} />
        </F>
      </Grid>
    </Modal>
  );
}

function ReceiptModal({ txn, onClose, onChanged }: { txn: Txn; onClose: () => void; onChanged: (m: string) => void }) {
  const { id } = useProfile();
  const { busy, error, run } = useSubmit();
  const fetchPdf = (open: boolean) => run(async () => {
    const r = await stu<{ filename: string; mime: string; base64: string }>(`/${enc(id)}/finance/receipts/${enc(txn.id)}`);
    downloadBase64(r.filename, r.mime, r.base64, open);
    return r;
  }, "Could not load receipt");
  return (
    <Modal title={`Receipt — Transaction #${txn.number}`} onClose={onClose} footer={<Btn onClick={onClose}>Close</Btn>}>
      <ErrorLine>{error}</ErrorLine>
      <dl className="st-detail">
        <dt>Transaction #</dt>
        <dd>{txn.number}</dd>
        <dt>Type</dt>
        <dd>{txn.type}</dd>
        <dt>Amount</dt>
        <dd>{money(txn.amount)}</dd>
        <dt>Entry Date</dt>
        <dd>{fmtDate(txn.entryDate)}</dd>
      </dl>
      <div className="st-inline">
        <Btn tone="primary" disabled={busy} onClick={() => void fetchPdf(true)}>
          Open Receipt
        </Btn>
        <Btn disabled={busy} onClick={() => void fetchPdf(false)}>
          Download Receipt
        </Btn>
        <Btn
          disabled={busy}
          onClick={async () => {
            const out = await run(() => send<{ message: string }>(`/${enc(id)}/finance/receipts/${enc(txn.id)}`, "POST"));
            if (out) onChanged(out.message);
          }}
        >
          Re-generate Receipt
        </Btn>
      </div>
    </Modal>
  );
}

export function FinancialTransactions() {
  const { id, notice } = useProfile();
  const paging = usePaging(25);
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState({ q: "", credit: false });
  const { data, error, reload } = useLoad<TxnList>(`/${enc(id)}/finance/transactions${qs({ q: applied.q, credit: applied.credit ? "true" : "", page: paging.page, perPage: paging.perPage })}`);
  const [refund, setRefund] = useState<Txn | "all" | null>(null);
  const [receipt, setReceipt] = useState<Txn | null>(null);
  return (
    <>
      <Card
        actions={
          <Btn small tone="primary" disabled={!data || data.refundable <= 0} onClick={() => setRefund("all")}>
            Issue Refund
          </Btn>
        }
      >
        <Filters
          submit="Search"
          onSubmit={() => {
            setApplied((a) => ({ ...a, q }));
            paging.reset();
          }}
        >
          <F label="Filter">
            <Txt value={q} onChange={setQ} placeholder="Enter Transaction #, Date, Status, etc." />
          </F>
          <div className="mh-sa__field" style={{ alignSelf: "end" }}>
            <Check
              checked={applied.credit}
              onChange={(v) => {
                setApplied((a) => ({ ...a, credit: v }));
                paging.reset();
              }}
            >
              Show Credit Allocation Transactions
            </Check>
          </div>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        <PagerFor data={data} paging={paging} />
        <Table head={["#", "Fund Source", "Entry Date", "Recorded Date", "Status", "Type", "Balance", ""]} empty={data ? "No transactions were found." : false}>
          {(data?.items ?? []).map((t) => (
            <tr key={`${t.kind}-${t.id}`}>
              <td>{t.number}</td>
              <td>{t.fundSource || "—"}</td>
              <td>{fmtDate(t.entryDate)}</td>
              <td>{fmtDate(t.recordedDate)}</td>
              <td>{t.status}</td>
              <td>{t.type}</td>
              <td>{money(t.balance)}</td>
              <td className="st-right">
                <span className="st-actions">
                  {t.kind === "payment" && t.refundable > 0 ? <LinkBtn onClick={() => setRefund(t)}>Refund</LinkBtn> : null}
                  {t.kind === "payment" || t.kind === "refund" ? <LinkBtn onClick={() => setReceipt(t)}>Receipt</LinkBtn> : null}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      {refund && data ? (
        <RefundModal
          txn={refund === "all" ? null : refund}
          list={data}
          onClose={() => setRefund(null)}
          onSaved={(m) => {
            setRefund(null);
            notice.ok(m);
            reload();
          }}
        />
      ) : null}
      {receipt ? (
        <ReceiptModal
          txn={receipt}
          onClose={() => setReceipt(null)}
          onChanged={(m) => {
            notice.ok(m);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Manage Invoices                                                      */
/* ------------------------------------------------------------------ */

type InvItem = { type: string; quantity: number; description: string; fee: number; total: number; chargeId?: string; courseId?: string };
type Invoices = {
  items: Array<{ id: string; number: number; dueDate: string; term: string; template: string; total: number; items: InvItem[]; date: string }>;
  templates: Array<{ id: string; name: string }>;
  terms: Term[];
  courses: Array<{ id: string; label: string; fee: number; textbooks: Array<{ id: string; name: string; fee: number }> }>;
  itemTypes: string[];
};

function AddItemModal({ inv, onClose, onAdd }: { inv: Invoices; onClose: () => void; onAdd: (items: InvItem[]) => void }) {
  const [type, setType] = useState(inv.itemTypes[0] ?? "Course");
  const [available, setAvailable] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [textbooks, setTextbooks] = useState(false);
  const [deps, setDeps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (type !== "Course") return;
    if (!selected.length) return setError("Select at least one course");
    const out: InvItem[] = [];
    for (const cid of selected) {
      const c = inv.courses.find((x) => x.id === cid);
      if (!c) continue;
      out.push({ type: "Course", quantity: 1, description: c.label, fee: c.fee, total: c.fee, courseId: c.id });
      if (textbooks) for (const t of c.textbooks) out.push({ type: "Textbook", quantity: 1, description: `${t.name} (${c.label.split(" — ")[0]})`, fee: t.fee, total: t.fee });
    }
    onAdd(out);
  };
  const avail = inv.courses.filter((c) => !selected.includes(c.id));
  return (
    <Modal title="Add Invoice Item" onClose={onClose} wide footer={<Btn tone="primary" disabled={type !== "Course"} onClick={save}>Save Invoice Item</Btn>}>
      <ErrorLine>{error}</ErrorLine>
      <F label="Item Type">
        <Sel value={type} onChange={setType} options={inv.itemTypes} />
      </F>
      {type === "Course" ? (
        <>
          <div className="st-transfer" style={{ marginTop: 10 }}>
            <F label="Available Courses">
              <select className="mh-sa__input" multiple value={available} onChange={(e) => setAvailable(Array.from(e.target.selectedOptions).map((o) => o.value))}>
                {avail.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </F>
            <div className="st-transfer__btns">
              <Btn small onClick={() => { setSelected((s) => [...s, ...available]); setAvailable([]); }}>
                Add
              </Btn>
              <Btn small onClick={() => { setSelected((s) => s.filter((x) => !picked.includes(x))); setPicked([]); }}>
                Remove
              </Btn>
            </div>
            <F label="Selected Courses">
              <select className="mh-sa__input" multiple value={picked} onChange={(e) => setPicked(Array.from(e.target.selectedOptions).map((o) => o.value))}>
                {selected.map((cid) => (
                  <option key={cid} value={cid}>
                    {inv.courses.find((c) => c.id === cid)?.label}
                  </option>
                ))}
              </select>
            </F>
          </div>
          <div className="lx-checks" style={{ marginTop: 10, display: "grid", gap: 6 }}>
            <Check checked={textbooks} onChange={setTextbooks}>
              Add Course Textbooks to Invoice
            </Check>
            <Check checked={deps} onChange={setDeps}>
              Add Course Fee Dependencies to Invoice
            </Check>
          </div>
          {deps ? <SourceNotice>Course fee dependency rules were not captured from the original system, so no dependent fees are added automatically.</SourceNotice> : null}
        </>
      ) : (
        <div style={{ marginTop: 10 }}>
          <SourceNotice>The conditional fields for the &quot;{type}&quot; item branch were not captured from the original system. To invoice an existing fee, use &quot;Add to Invoice&quot; from the student&apos;s unpaid fees.</SourceNotice>
        </div>
      )}
    </Modal>
  );
}

function CreateInvoice({ inv, unpaid, onClose, onSaved }: { inv: Invoices; unpaid: LedgerRow[]; onClose: () => void; onSaved: (m: string) => void }) {
  const { id, header } = useProfile();
  const [f, setF] = useState({ dueDate: "", termId: "", templateId: "" });
  const [items, setItems] = useState<InvItem[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState(false);
  const [adding, setAdding] = useState(false);
  const { busy, error, setError, run } = useSubmit();
  const inInvoice = new Set(items.map((i) => i.chargeId).filter(Boolean));
  const total = items.reduce((t, i) => t + i.total, 0);
  const save = async () => {
    if (!f.dueDate) return setError("Due Date is required");
    if (!items.length) return setError("Add at least one invoice item");
    const out = await run(() => send<{ message: string }>(`/${enc(id)}/finance/invoices`, "POST", { ...f, items: items.map((i) => (i.chargeId ? { chargeId: i.chargeId } : i)) }));
    if (out) onSaved(out.message);
  };
  return (
    <Card title="Create Invoice" actions={<Btn small onClick={onClose}>Cancel</Btn>}>
      <ErrorLine>{error}</ErrorLine>
      <Grid>
        <F label="Selected Student">
          <span className="st-pill">
            {header.name} ({header.studentNumber})
          </span>
        </F>
        <F label="Due Date" req>
          <Txt type="date" value={f.dueDate} onChange={(v) => setF((s) => ({ ...s, dueDate: v }))} />
        </F>
        <F label="Term">
          <Sel value={f.termId} onChange={(v) => setF((s) => ({ ...s, termId: v }))} empty="— None —" options={inv.terms.map((t) => ({ value: t.id, label: t.name }))} />
        </F>
        <F label="Invoice Template">
          <Sel value={f.templateId} onChange={(v) => setF((s) => ({ ...s, templateId: v }))} empty={inv.templates.length ? "— Select —" : "No invoice templates configured"} options={inv.templates.map((t) => ({ value: t.id, label: t.name }))} />
        </F>
      </Grid>
      <h3 style={{ fontSize: 14, margin: "14px 0 6px" }}>Student&apos;s Unpaid Fees</h3>
      <Table head={["", "#", "Fee", "Owing"]} empty="This student has no unpaid fees.">
        {unpaid.map((u) => (
          <tr key={u.id}>
            <td className="st-row-sel">
              <input type="checkbox" aria-label={`Select fee ${u.number}`} disabled={inInvoice.has(u.id)} checked={checked.has(u.id) || inInvoice.has(u.id)} onChange={(e) => setChecked((s) => { const n = new Set(s); if (e.target.checked) n.add(u.id); else n.delete(u.id); return n; })} />
            </td>
            <td>{u.number}</td>
            <td>{u.type}</td>
            <td>{money(u.owing)}</td>
          </tr>
        ))}
      </Table>
      <div className="st-inline" style={{ margin: "8px 0 14px" }}>
        <Btn
          small
          disabled={!checked.size}
          onClick={() => {
            setItems((list) => [...list, ...unpaid.filter((u) => checked.has(u.id)).map((u) => ({ type: "Other Fee / Ledger Item", quantity: 1, description: `#${u.number} ${u.type}`, fee: u.owing, total: u.owing, chargeId: u.id }))]);
            setChecked(new Set());
          }}
        >
          Add to Invoice
        </Btn>
        <Btn small onClick={() => setManual(true)}>
          Manual Invoice
        </Btn>
      </div>
      <h3 style={{ fontSize: 14, margin: "0 0 6px" }}>Invoice Items</h3>
      <Table head={["Quantity", "Description", "Fee", "Total", ""]} empty="No invoice items yet.">
        {items.map((i, idx) => (
          <tr key={idx}>
            <td>{i.quantity}</td>
            <td>
              {i.description}
              <div className="mh-sa__muted" style={{ fontSize: 12 }}>{i.type}</div>
            </td>
            <td>{money(i.fee)}</td>
            <td>{money(i.total)}</td>
            <td className="st-right">
              <LinkBtn danger onClick={() => setItems((l) => l.filter((_, j) => j !== idx))}>
                Remove
              </LinkBtn>
            </td>
          </tr>
        ))}
      </Table>
      <div className="st-inline" style={{ justifyContent: "space-between", marginTop: 10 }}>
        {manual ? (
          <Btn small onClick={() => setAdding(true)}>
            Add Item
          </Btn>
        ) : (
          <span />
        )}
        <span>
          Invoice Total: <strong>{money(total)}</strong>
        </span>
      </div>
      <div className="st-filters__actions" style={{ marginTop: 12 }}>
        <Btn tone="primary" disabled={busy} onClick={() => void save()}>
          Save Invoice
        </Btn>
      </div>
      <p className="pm-note mh-sa__muted">Saving records the invoice document only; it does not post new fees. Issuing or sending the invoice was not captured from the original system.</p>
      {adding ? (
        <AddItemModal
          inv={inv}
          onClose={() => setAdding(false)}
          onAdd={(list) => {
            setItems((l) => [...l, ...list]);
            setAdding(false);
          }}
        />
      ) : null}
    </Card>
  );
}

export function ManageInvoices() {
  const { id, notice } = useProfile();
  const { data, error, reload } = useLoad<Invoices>(`/${enc(id)}/finance/invoices`);
  const { data: ov } = useLoad<Overview>(`/${enc(id)}/finance/overview`);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Invoices["items"][number] | null>(null);
  if (!data) return error ? <ErrorLine>{error}</ErrorLine> : <Empty>Loading…</Empty>;
  return (
    <>
      {creating ? (
        <CreateInvoice
          inv={data}
          unpaid={ov?.unpaidFees ?? []}
          onClose={() => setCreating(false)}
          onSaved={(m) => {
            setCreating(false);
            notice.ok(m);
            reload();
          }}
        />
      ) : null}
      <Card
        title="Invoices"
        actions={
          !creating ? (
            <Btn small tone="primary" onClick={() => setCreating(true)}>
              Create Invoice
            </Btn>
          ) : null
        }
      >
        <Table head={["#", "Date", "Due Date", "Term", "Template", "Total"]} empty="No invoices were found.">
          {data.items.map((i) => (
            <tr key={i.id}>
              <td>
                <LinkBtn onClick={() => setOpen(i)}>{i.number}</LinkBtn>
              </td>
              <td>{fmtDate(i.date)}</td>
              <td>{fmtDate(i.dueDate)}</td>
              <td>{i.term || "—"}</td>
              <td>{i.template || "—"}</td>
              <td>{money(i.total)}</td>
            </tr>
          ))}
        </Table>
      </Card>
      {open ? (
        <Modal title={`Invoice #${open.number}`} onClose={() => setOpen(null)} wide footer={<Btn onClick={() => setOpen(null)}>Close</Btn>}>
          <Table head={["Quantity", "Description", "Fee", "Total"]}>
            {open.items.map((i, idx) => (
              <tr key={idx}>
                <td>{i.quantity}</td>
                <td>{i.description}</td>
                <td>{money(i.fee)}</td>
                <td>{money(i.total)}</td>
              </tr>
            ))}
          </Table>
          <p className="pm-note">
            Total: <strong>{money(open.total)}</strong> · Due {fmtDate(open.dueDate)}
          </p>
        </Modal>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Disbursements & Credits                                              */
/* ------------------------------------------------------------------ */

type Disb = { id: string; number: string; fundType: string; typeId: string; status: string; recordDate: string; total: number; balance: number; allocated: number; note: string; advance: boolean };

function DisbModal({ rec, types, onClose, onSaved }: { rec: Disb | null; types: Array<{ id: string; name: string }>; onClose: () => void; onSaved: (m: string) => void }) {
  const { id } = useProfile();
  const [f, setF] = useState({ typeId: rec?.typeId ?? "", amount: rec ? String(rec.total) : "", note: rec?.note ?? "" });
  const { busy, error, setError, run } = useSubmit();
  const save = async () => {
    if (!rec?.advance && (!f.typeId || !f.amount)) return setError("Disbursement Type and Disbursement Amount are required");
    const body = rec?.advance ? { note: f.note } : { ...f, amount: Number(f.amount) };
    const out = await run(() => (rec ? send<{ message: string }>(`/${enc(id)}/finance/disbursements/${enc(rec.id)}`, "PUT", body) : send<{ message: string }>(`/${enc(id)}/finance/disbursements`, "POST", body)));
    if (out) onSaved(out.message);
  };
  return (
    <Modal title={rec ? `Edit Disbursement #${rec.number}` : "Create Disbursement"} onClose={onClose} footer={<Btn tone="primary" disabled={busy} onClick={() => void save()}>Save Disbursement</Btn>}>
      <ErrorLine>{error}</ErrorLine>
      <Grid>
        {rec?.advance ? (
          <F label="Disbursement Type">
            <span>{rec.fundType}</span>
          </F>
        ) : (
          <>
            <F label="Disbursement Type" req>
              <Sel value={f.typeId} onChange={(v) => setF((s) => ({ ...s, typeId: v }))} empty="— Select —" options={types.map((t) => ({ value: t.id, label: t.name }))} />
            </F>
            <F label="Disbursement Amount" req>
              <Txt type="number" value={f.amount} onChange={(v) => setF((s) => ({ ...s, amount: v }))} />
            </F>
          </>
        )}
        <F label="Note / Comment" wide>
          <textarea className="mh-sa__input" rows={3} value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} />
        </F>
      </Grid>
    </Modal>
  );
}

export function DisbursementsCredits() {
  const { id, notice } = useProfile();
  const { data, error, reload } = useLoad<{ items: Disb[]; types: Array<{ id: string; name: string }> }>(`/${enc(id)}/finance/disbursements`);
  const [editing, setEditing] = useState<Disb | null | "new">(null);
  const [removing, setRemoving] = useState<Disb | null>(null);
  const done = (m: string) => {
    setEditing(null);
    notice.ok(m);
    reload();
  };
  return (
    <>
      <Card
        actions={
          <Btn small tone="primary" onClick={() => setEditing("new")}>
            Create Disbursement
          </Btn>
        }
      >
        <ErrorLine>{error}</ErrorLine>
        <Table head={["#", "Fund Type", "Status", "Record Date", "Total", "Balance", "Allocated", ""]} empty={data ? "No disbursements or credits were found." : false}>
          {(data?.items ?? []).map((d) => (
            <tr key={d.id}>
              <td>{d.number}</td>
              <td>{d.fundType}</td>
              <td>{d.status}</td>
              <td>{fmtDate(d.recordDate)}</td>
              <td>{money(d.total)}</td>
              <td>{money(d.balance)}</td>
              <td>{money(d.allocated)}</td>
              <td className="st-right">
                <span className="st-actions">
                  <LinkBtn onClick={() => setEditing(d)}>Edit</LinkBtn>
                  {!d.advance ? (
                    <LinkBtn danger onClick={() => setRemoving(d)}>
                      Remove
                    </LinkBtn>
                  ) : null}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      {editing && data ? <DisbModal rec={editing === "new" ? null : editing} types={data.types} onClose={() => setEditing(null)} onSaved={done} /> : null}
      {removing ? (
        <ConfirmModal
          title="Remove Disbursement"
          body={`Remove disbursement #${removing.number} (${removing.fundType}, ${money(removing.total)})? Any allocations will be released.`}
          ok="Confirm Remove"
          onCancel={() => setRemoving(null)}
          onOk={async () => {
            try {
              const out = await send<{ message: string }>(`/${enc(id)}/finance/disbursements/${enc(removing.id)}`, "DELETE");
              done(out.message);
            } catch (e) {
              notice.fail(errMsg(e, "Could not remove disbursement"));
            }
            setRemoving(null);
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Promotions & Awards                                                  */
/* ------------------------------------------------------------------ */

type Awards = {
  items: Array<{ id: string; number: number; name: string; status: string; amount: number; allocated: number; remaining: number }>;
  eligible: Array<{ id: string; name: string; amount: number; eligibility: string }>;
  configuredPromotions: number;
  options: { statuses: string[]; allocation: string[]; eligibility: string[] };
};

export function PromotionsAwards() {
  const { id, notice } = useProfile();
  const { data, error, reload } = useLoad<Awards>(`/${enc(id)}/finance/awards`);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ promotionId: "", status: "", allocation: "", eligibility: "", note: "" });
  const { busy, error: saveError, setError, run } = useSubmit();
  if (!data) return error ? <ErrorLine>{error}</ErrorLine> : <Empty>Loading…</Empty>;
  const o = data.options;
  const save = async () => {
    if (!f.promotionId) return setError("Select a Promotion / Award");
    const out = await run(() => send<{ message: string }>(`/${enc(id)}/finance/awards`, "POST", { ...f, status: f.status || o.statuses[0], allocation: f.allocation || o.allocation[0] }));
    if (out) {
      setOpen(false);
      notice.ok(out.message);
      reload();
    }
  };
  return (
    <>
      {!data.eligible.length ? (
        <p className="st-warning">
          {data.configuredPromotions ? "This student does not currently meet any promotion or award eligibility rules." : "No active promotions or awards are configured."}{" "}
          <a href="/admin/financial/promotions/new">Add Promotion / Award</a>
        </p>
      ) : null}
      <Card
        actions={
          <Btn small tone="primary" onClick={() => setOpen(true)}>
            Add Promotion / Award
          </Btn>
        }
      >
        <Table head={["#", "Promotion / Award", "Status", "Amount", "Allocated", "Remaining"]} empty="No promotions or awards were found.">
          {data.items.map((a) => (
            <tr key={a.id}>
              <td>{a.number}</td>
              <td>{a.name}</td>
              <td>{a.status}</td>
              <td>{money(a.amount)}</td>
              <td>{money(a.allocated)}</td>
              <td>{money(a.remaining)}</td>
            </tr>
          ))}
        </Table>
      </Card>
      {open ? (
        <Modal
          title="Add Promotion / Award"
          onClose={() => setOpen(false)}
          footer={
            data.eligible.length ? (
              <Btn tone="primary" disabled={busy || !o.allocation.length} onClick={() => void save()}>
                Save Promotion / Award
              </Btn>
            ) : (
              <Btn onClick={() => setOpen(false)}>Close</Btn>
            )
          }
        >
          <ErrorLine>{saveError}</ErrorLine>
          {!data.eligible.length ? (
            <p className="st-warning">
              {data.configuredPromotions ? "This student does not currently meet any promotion or award eligibility rules." : "No active promotions or awards are configured."}{" "}
              <a href="/admin/financial/promotions/new">Add Promotion / Award</a>
            </p>
          ) : (
            <Grid>
              {!o.allocation.length ? (
                <p className="st-warning">
                  No active Promotion Allocation is configured. <a href="/admin/financial/promotion-allocations">Add Promotion Allocation</a>
                </p>
              ) : null}
              <F label="Promotion / Award" req>
                <Sel
                  value={f.promotionId}
                  onChange={(v) => setF((s) => ({ ...s, promotionId: v, eligibility: data.eligible.find((e) => e.id === v)?.eligibility ?? s.eligibility }))}
                  empty="— Select —"
                  options={data.eligible.map((e) => ({ value: e.id, label: `${e.name} (${money(e.amount)})` }))}
                />
              </F>
              <F label="Promotion / Award Status">
                <Sel value={f.status || o.statuses[0]!} onChange={(v) => setF((s) => ({ ...s, status: v }))} options={o.statuses} />
              </F>
              <F label="Promotion Allocation">
                <Sel value={f.allocation || o.allocation[0] || ""} onChange={(v) => setF((s) => ({ ...s, allocation: v }))} empty="— Select —" options={o.allocation} />
                <span className="lx-hint">
                  Options come from <a href="/admin/financial/promotion-allocations">Financial Management → Promotion Allocations</a>.
                </span>
              </F>
              <F label="Promotion Eligibility">
                <Sel value={f.eligibility || o.eligibility[0]!} onChange={(v) => setF((s) => ({ ...s, eligibility: v }))} options={o.eligibility} />
              </F>
              <F label="Note / Comment" wide>
                <textarea className="mh-sa__input" rows={2} value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} />
              </F>
            </Grid>
          )}
        </Modal>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Payment Plans & Collections                                          */
/* ------------------------------------------------------------------ */

type Plan = {
  id: string;
  number: number;
  status: string;
  nextPayment: string;
  term: string;
  termId: string;
  instalments: number;
  interest: number;
  debt: number;
  paid: number;
  remaining: number;
  startDate: string;
  sync: string;
  includeCredit: boolean;
  applyInterest: boolean;
  scheduleType: string;
  frequency: string;
  instalmentAmount: number;
  promptConditions: string;
  notes: string;
};
type Plans = { items: Plan[]; terms: Term[]; balances: { total: { debit: number; credit: number; debt: number }; credit: number }; options: { sync: string[]; scheduleTypes: string[]; frequencies: string[] } };

function PlanModal({ plan, data, onClose, onSaved }: { plan: Plan | null; data: Plans; onClose: () => void; onSaved: (m: string) => void }) {
  const { id } = useProfile();
  const o = data.options;
  const [f, setF] = useState({
    startDate: plan?.startDate ?? today(),
    termId: plan?.termId ?? "",
    sync: plan?.sync || o.sync[0] || "Disabled",
    includeCredit: plan?.includeCredit ?? false,
    debt: plan ? String(plan.debt) : "",
    applyInterest: plan?.applyInterest ?? false,
    scheduleType: plan?.scheduleType || o.scheduleTypes[0] || "",
    frequency: plan?.frequency || "1 month",
    instalmentAmount: plan ? String(plan.instalmentAmount) : "",
    promptConditions: plan?.promptConditions ?? "",
    notes: plan?.notes ?? "",
  });
  const { busy, error, setError, run } = useSubmit();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const debit = data.balances.total.debit;
  const credit = data.balances.credit;
  const totalDebt = Math.max(0, debit - (f.includeCredit ? credit : 0));
  const manual = f.scheduleType !== "Fixed Instalment Frequency";
  const count = useMemo(() => {
    const debt = f.sync === "Disabled" ? Number(f.debt) : totalDebt;
    const amt = Number(f.instalmentAmount);
    return debt > 0 && amt > 0 ? Math.ceil(debt / amt - 1e-9) : 0;
  }, [f.sync, f.debt, f.instalmentAmount, totalDebt]);
  const save = async () => {
    if (!f.startDate) return setError("Start Date is required");
    const out = await run(() => (plan ? send<{ message: string }>(`/${enc(id)}/finance/plans/${enc(plan.id)}`, "PUT", f) : send<{ message: string }>(`/${enc(id)}/finance/plans`, "POST", f)));
    if (out) onSaved(out.message);
  };
  return (
    <Modal title={plan ? `Edit Payment Plan #${plan.number}` : "Create Payment Plan"} onClose={onClose} wide footer={<Btn tone="primary" disabled={busy || manual} onClick={() => void save()}>Save Payment Plan</Btn>}>
      <ErrorLine>{error}</ErrorLine>
      <Grid>
        <F label="Start Date" req>
          <Txt type="date" value={f.startDate} onChange={(v) => set("startDate", v)} />
        </F>
        <F label="Term">
          <Sel value={f.termId} onChange={(v) => set("termId", v)} empty="— None —" options={data.terms.map((t) => ({ value: t.id, label: t.name }))} />
        </F>
        <F label="Synchronize Balance">
          <Sel value={f.sync} onChange={(v) => set("sync", v)} options={o.sync} />
        </F>
        <div className="mh-sa__field" style={{ alignSelf: "end" }}>
          <Check checked={f.includeCredit} onChange={(v) => set("includeCredit", v)}>
            Include pre-payment / credit balance
          </Check>
        </div>
        <F label="Debit Balance">
          <input className="mh-sa__input" readOnly value={f.sync === "With term balance" ? "Calculated from the term on save" : money(debit)} />
        </F>
        <F label="Credit Balance">
          <input className="mh-sa__input" readOnly value={money(credit)} />
        </F>
        <F label="Debt Amount" req={f.sync === "Disabled"}>
          {f.sync === "Disabled" ? <Txt type="number" value={f.debt} onChange={(v) => set("debt", v)} /> : <input className="mh-sa__input" readOnly value={f.sync === "With term balance" ? "Calculated from the term on save" : money(totalDebt)} />}
        </F>
        <div className="mh-sa__field" style={{ alignSelf: "end" }}>
          <Check checked={f.applyInterest} onChange={(v) => set("applyInterest", v)}>
            Apply Interest
          </Check>
        </div>
        <F label="Schedule Type">
          <Sel value={f.scheduleType} onChange={(v) => set("scheduleType", v)} options={o.scheduleTypes} />
        </F>
        {!manual ? (
          <>
            <F label="Instalment Frequency">
              <Sel value={f.frequency} onChange={(v) => set("frequency", v)} options={o.frequencies.map((x) => ({ value: x, label: `Every ${x}` }))} />
            </F>
            <F label="Instalment Amount" req hint={count ? `${count} instalment(s)` : undefined}>
              <Txt type="number" value={f.instalmentAmount} onChange={(v) => set("instalmentAmount", v)} />
            </F>
          </>
        ) : null}
        <F label="Prompt Conditions" wide>
          <Txt value={f.promptConditions} onChange={(v) => set("promptConditions", v)} />
        </F>
        <F label="Notes / Comments" wide>
          <textarea className="mh-sa__input" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </F>
      </Grid>
      {manual ? <SourceNotice>The Manual / Advanced instalment entry form was not captured from the original system. Use Fixed Instalment Frequency.</SourceNotice> : null}
      {f.applyInterest ? <p className="pm-note mh-sa__muted">Interest rates were not captured from the original system; plans record interest as $0.00.</p> : null}
    </Modal>
  );
}

export function PaymentPlans() {
  const { id, notice } = useProfile();
  const [draft, setDraft] = useState({ q: "", term: "" });
  const [applied, setApplied] = useState(draft);
  const { data, error, reload } = useLoad<Plans>(`/${enc(id)}/finance/plans${qs(applied)}`);
  const [editing, setEditing] = useState<Plan | null | "new">(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const done = (m: string) => {
    setEditing(null);
    notice.ok(m);
    reload();
  };
  return (
    <>
      <Card
        actions={
          <Btn small tone="primary" disabled={!data} onClick={() => setEditing("new")}>
            Create Payment Plan
          </Btn>
        }
      >
        <Filters submit="Search" onSubmit={() => setApplied({ ...draft })}>
          <F label="Filter">
            <Txt value={draft.q} onChange={(v) => setDraft((d) => ({ ...d, q: v }))} placeholder="Plan #, Date, Status" />
          </F>
          <F label="Term">
            <Sel value={draft.term} onChange={(v) => setDraft((d) => ({ ...d, term: v }))} empty="All Terms" options={(data?.terms ?? []).map((t) => ({ value: t.id, label: t.name }))} />
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        <Table head={["#", "Status", "Next Payment", "Term", "Instalments", "Interest", "Debt", "Paid", "Remaining", ""]} empty={data ? "No payment plans were found." : false}>
          {(data?.items ?? []).map((p) => (
            <tr key={p.id}>
              <td>{p.number}</td>
              <td>{p.status}</td>
              <td>{p.nextPayment || "—"}</td>
              <td>{p.term || "—"}</td>
              <td>{p.instalments}</td>
              <td>{money(p.interest)}</td>
              <td>{money(p.debt)}</td>
              <td>{money(p.paid)}</td>
              <td>{money(p.remaining)}</td>
              <td className="st-right">
                <span className="st-actions">
                  <LinkBtn onClick={() => setEditing(p)}>Edit</LinkBtn>
                  <LinkBtn danger onClick={() => setDeleting(p)}>
                    Delete
                  </LinkBtn>
                </span>
              </td>
            </tr>
          ))}
        </Table>
        <p className="pm-note mh-sa__muted">A payment plan is a schedule only; instalments are counted as paid when payments are applied to the student account.</p>
      </Card>
      {editing && data ? <PlanModal plan={editing === "new" ? null : editing} data={data} onClose={() => setEditing(null)} onSaved={done} /> : null}
      {deleting ? (
        <ConfirmModal
          title="Delete Payment Plan"
          body={`Delete payment plan #${deleting.number}?`}
          ok="Delete Payment Plan"
          onCancel={() => setDeleting(null)}
          onOk={async () => {
            try {
              const out = await send<{ message: string }>(`/${enc(id)}/finance/plans/${enc(deleting.id)}`, "DELETE");
              done(out.message);
            } catch (e) {
              notice.fail(errMsg(e, "Could not delete payment plan"));
            }
            setDeleting(null);
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Documents & Tax Forms / Finance Audit                                */
/* ------------------------------------------------------------------ */

export function FinanceDocuments() {
  const { id } = useProfile();
  const { data, error } = useLoad<{ items: string[] }>(`/${enc(id)}/finance/tax`);
  const [choice, setChoice] = useState("");
  return (
    <Card title="Documents & Tax Forms">
      <ErrorLine>{error}</ErrorLine>
      <Grid>
        <F label="Document / Tax Form">
          <Sel value={choice} onChange={setChoice} empty="— Select —" options={data?.items ?? []} />
        </F>
      </Grid>
      {choice ? (
        <div style={{ marginTop: 12 }}>
          <SourceNotice>The generation inputs and output for &quot;{choice}&quot; were not captured from the original system. Official T2202 slips are produced from Financial Management › Tax Documents.</SourceNotice>
        </div>
      ) : null}
    </Card>
  );
}

export function FinanceAudit() {
  const { id } = useProfile();
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const { data, error } = useLoad<{ items: AuditItem[] }>(`/${enc(id)}/finance/audit${qs({ q: applied })}`);
  const [open, setOpen] = useState<AuditItem | null>(null);
  return (
    <>
      <Card>
        <Filters submit="Search" onSubmit={() => setApplied(q)}>
          <F label="Filter">
            <Txt value={q} onChange={setQ} placeholder="Action, user or date" />
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        <Table head={["Date", "By", "Action(s)"]} empty={data ? "No finance audit records were found." : false}>
          {(data?.items ?? []).map((a) => (
            <tr key={a.id}>
              <td>{fmtStamp(a.date)}</td>
              <td>{a.by}</td>
              <td>
                <LinkBtn onClick={() => setOpen(a)}>{a.action}</LinkBtn>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      {open ? <AuditDetail item={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
