/* Student self-service fee payment through Stripe hosted Checkout, posted to the Financial Management ledger. */

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { EPS, allocateFund, cad, finAudit, httpError, loadBook, loadConfig, nameOf, postEntry, r2, requireStudent as financeStudent, syncChargeStatuses } from "../admin/heritage/finance.core.js";
import { generateReceipt, type StudentCtx } from "../admin/heritage/finance.ledger.js";
import { withStudentMoneyLock } from "../admin/heritage/studentLock.js";
import { requireStudent } from "./surfaces.service.js";

const PURPOSE = "student_fee";
// Stripe requires the CAD total to convert to at least US$0.50.
const MIN_CAD = 1;

type StripeSession = {
  id: string;
  url: string | null;
  status: string | null;
  payment_status: string;
  currency: string | null;
  amount_total: number | null;
  payment_intent: string | null;
  metadata: Record<string, string> | null;
};

function stripeKey() {
  const key = process.env.STRIPE_SECRET_KEY || "";
  return key.startsWith("sk_test_") || key.startsWith("sk_live_") ? key : "";
}

export const studentPaymentsEnabled = () => Boolean(stripeKey());

async function stripe<T>(path: string, form?: URLSearchParams): Promise<T> {
  const key = stripeKey();
  if (!key) throw httpError(503, "Online fee payment is not configured.", "PAYMENT_UNAVAILABLE");
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: form ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key}`, ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw httpError(502, json.error?.message || "The payment provider rejected the request.", "PAYMENT_PROVIDER_ERROR");
  return json;
}

function webOrigin() {
  const base = process.env.WEB_PUBLIC_URL || (process.env.WEB_ORIGIN ?? "").split(",")[0] || "http://localhost:3000";
  return base.trim().replace(/\/+$/, "");
}

async function ledgerCtx(user: SessionClaims, studentId: string): Promise<StudentCtx> {
  const inst = user.institutionId;
  const cfg = await loadConfig(inst);
  const st = await financeStudent(inst, studentId);
  return { user, inst, cfg, st, book: await loadBook(inst, cfg, studentId) };
}

export async function createFeeCheckout(user: SessionClaims, body: { amountCad?: unknown }) {
  const student = await requireStudent(user);
  const c = await ledgerCtx(user, student.id);
  const owing = r2(c.book.balance);
  if (owing < MIN_CAD) throw httpError(409, "You have no balance to pay.", "NOTHING_OWING");
  const requested = body.amountCad === undefined || body.amountCad === null || body.amountCad === "" ? owing : r2(Number(body.amountCad));
  if (!Number.isFinite(requested) || requested < MIN_CAD) throw httpError(400, `Payment amount must be at least ${cad(MIN_CAD)}.`, "VALIDATION");
  if (requested > owing + EPS) throw httpError(400, `Payment amount cannot exceed your balance of ${cad(owing)}.`, "VALIDATION");

  const origin = webOrigin();
  const successUrl = `${origin}/student/fees?paid=1`;
  const cancelUrl = `${origin}/student/fees?canceled=1`;
  const form = new URLSearchParams({
    mode: "payment",
    "payment_method_types[0]": "card",
    locale: "en",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "cad",
    "line_items[0][price_data][unit_amount]": String(Math.round(requested * 100)),
    "line_items[0][price_data][product_data][name]": "Tuition & fees payment",
    "line_items[0][price_data][product_data][description]": `${c.st.name} · Student #${c.st.number}`,
    success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    client_reference_id: student.id,
    "metadata[purpose]": PURPOSE,
    "metadata[institutionId]": user.institutionId,
    "metadata[studentId]": student.id,
    "metadata[accountId]": user.accountId,
    "metadata[amountCad]": requested.toFixed(2),
  });
  if (c.st.email) form.set("customer_email", c.st.email);
  const session = await stripe<StripeSession>("/checkout/sessions", form);
  if (!session.url) throw httpError(502, "The payment provider did not return a checkout page.", "PAYMENT_PROVIDER_ERROR");
  return { url: session.url, sessionId: session.id, amountCad: requested, successUrl, cancelUrl };
}

async function cardBrand(paymentIntentId: string) {
  try {
    const pi = await stripe<{ latest_charge?: { payment_method_details?: { card?: { brand?: string } } } | null }>(
      `/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge`,
    );
    return pi.latest_charge?.payment_method_details?.card?.brand?.toLowerCase() ?? "";
  } catch {
    return "";
  }
}

function brandMatches(brand: string, name: string) {
  const n = name.toLowerCase();
  if (brand === "amex") return n.includes("amex") || n.includes("american express");
  if (brand === "mastercard") return n.includes("master");
  return n.includes(brand);
}

export async function confirmFeeCheckout(user: SessionClaims, body: { sessionId?: unknown }) {
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!/^cs_[A-Za-z0-9_]{8,250}$/.test(sessionId)) throw httpError(400, "Missing payment session.", "VALIDATION");
  const student = await requireStudent(user);
  const session = await stripe<StripeSession>(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
  const m = session.metadata ?? {};
  if (m.purpose !== PURPOSE || m.studentId !== student.id || m.institutionId !== user.institutionId) {
    throw httpError(403, "This payment belongs to another account.", "PAYMENT_OWNER_MISMATCH");
  }
  if (session.status !== "complete" || session.payment_status !== "paid" || session.currency?.toLowerCase() !== "cad" || !session.amount_total) {
    throw httpError(409, "This payment has not been completed.", "PAYMENT_INCOMPLETE");
  }
  const amount = r2(session.amount_total / 100);

  return withStudentMoneyLock(user.institutionId, student.id, async () => {
    const path = `finance:stripe:${sessionId}`;
    const existing = await prisma.sisScreenState.findUnique({ where: { institutionId_path: { institutionId: user.institutionId, path } } });
    if (existing) return { ...(JSON.parse(existing.payloadJson) as { entryId: string; number: number; amountCad: number }), alreadyRecorded: true };

    const c = await ledgerCtx(user, student.id);
    const brand = session.payment_intent ? await cardBrand(session.payment_intent) : "";
    const cards = c.cfg.paymentMethods.filter((p) => Boolean(p.data.creditCard) || /card|visa|master|amex|american express/i.test(nameOf(p)));
    const method = brand ? cards.find((p) => brandMatches(brand, nameOf(p))) : undefined;
    const methodName = method ? nameOf(method) : "Credit Card";
    const { entry, number } = await postEntry(
      user,
      { studentId: c.st.id, kind: "payment", label: "Online Payment", amount, source: methodName, note: `Paid online by card (Stripe ${session.payment_intent ?? sessionId})` },
      { method: methodName, methodId: method?.id ?? "", payee: "Student", paymentType: "Standard", stripeSessionId: sessionId, stripePaymentIntent: session.payment_intent ?? "" },
    );
    const payload = { entryId: entry.id, number, amountCad: amount };
    try {
      await prisma.sisScreenState.create({ data: { institutionId: user.institutionId, path, payloadJson: JSON.stringify(payload) } });
    } catch (error) {
      if ((error as { code?: string })?.code !== "P2002") throw error;
    }
    c.book = await loadBook(c.inst, c.cfg, c.st.id);
    const applied = await allocateFund(user, c.book, entry.id);
    c.book = await syncChargeStatuses(user, c.cfg, c.st.id);
    await generateReceipt(user, entry.id, c);
    await finAudit(user, c.st.id, "Payment recorded", `Transaction #${number}`, { type: "Online card payment", method: methodName, payee: "Student", amount: cad(amount), applied: cad(applied), stripe: session.payment_intent ?? sessionId }, entry.id);
    return { ...payload, alreadyRecorded: false };
  });
}
