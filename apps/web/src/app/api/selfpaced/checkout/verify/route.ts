import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getSelfpacedProgram } from "@/lib/selfpacedPrograms";
import { STRIPE_SECRET_KEY, useHostedStripeCheckout } from "@/lib/selfpacedStripe";
import { API_URL } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyBody = {
  sessionId?: string;
  slug?: string;
  demo?: boolean;
  free?: boolean;
};

async function resolveProgram(slug: string) {
  const local = getSelfpacedProgram(slug);
  if (local) return local;
  const response = await fetch(`${API_URL.replace(/\/$/, "")}/selfpaced/programs/${encodeURIComponent(slug)}`, { cache: "no-store" });
  return response.ok ? await response.json() as ReturnType<typeof getSelfpacedProgram> : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VerifyBody;
    const program = await resolveProgram(body.slug || "");
    if (!program) {
      return NextResponse.json({ verified: false, error: "Unknown program." }, { status: 404 });
    }

    if (body.free === true) {
      if (program.priceCad !== 0) return NextResponse.json({ verified: false, error: "This program is not free." }, { status: 409 });
      return NextResponse.json({ verified: true, mode: "free", programId: program.id, programSlug: program.slug, amountCad: 0 });
    }

    // Demo checkout is deliberately available only when the server explicitly enables it.
    if (body.demo === true) {
      if (process.env.SELFPACED_STRIPE_DEMO !== "1") {
        return NextResponse.json({ verified: false, error: "Demo checkout is disabled." }, { status: 403 });
      }
      return NextResponse.json({
        verified: true,
        mode: "demo",
        programId: program.id,
        programSlug: program.slug,
        amountCad: program.priceCad,
      });
    }

    if (!body.sessionId || !body.sessionId.startsWith("cs_")) {
      return NextResponse.json({ verified: false, error: "Missing Stripe checkout session." }, { status: 400 });
    }
    if (!useHostedStripeCheckout()) {
      return NextResponse.json({ verified: false, error: "Stripe verification is not configured." }, { status: 503 });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(body.sessionId);
    const expectedAmount = Math.round(program.priceCad * 100);
    const metadataMatches =
      session.metadata?.programId === program.id && session.metadata?.programSlug === program.slug;
    const paymentMatches =
      session.status === "complete" &&
      session.payment_status === "paid" &&
      session.currency?.toLowerCase() === "cad" &&
      session.amount_total === expectedAmount;

    if (!metadataMatches || !paymentMatches) {
      return NextResponse.json(
        { verified: false, error: "Payment does not match this program." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      verified: true,
      mode: "stripe_hosted",
      sessionId: session.id,
      programId: program.id,
      programSlug: program.slug,
      amountCad: program.priceCad,
      customerEmail: session.customer_details?.email || null,
    });
  } catch (err) {
    console.error("selfpaced checkout verification", err);
    return NextResponse.json(
      { verified: false, error: "We could not verify this payment. Please try again or contact support." },
      { status: 502 },
    );
  }
}
