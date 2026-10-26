import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getSelfpacedProgram } from "@/lib/selfpacedPrograms";
import { STRIPE_SECRET_KEY, useHostedStripeCheckout } from "@/lib/selfpacedStripe";
import { API_URL } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveProgram(slug: string) {
  const local = getSelfpacedProgram(slug);
  if (local) return local;
  const response = await fetch(`${API_URL.replace(/\/$/, "")}/selfpaced/programs/${encodeURIComponent(slug)}`, { cache: "no-store" });
  return response.ok ? await response.json() as ReturnType<typeof getSelfpacedProgram> : undefined;
}

function originFrom(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { slug?: string };
    const program = await resolveProgram(body.slug || "");
    if (!program) {
      return NextResponse.json({ error: "Unknown program" }, { status: 404 });
    }

    const origin = originFrom(req);

    if (program.priceCad === 0) {
      return NextResponse.json({
        url: `${origin}/selfpaced/success?slug=${encodeURIComponent(program.slug)}&free=1&programId=${encodeURIComponent(program.id)}&amount=0`,
        mode: "free",
        programId: program.id,
        programSlug: program.slug,
        priceCad: 0,
      });
    }

    if (!useHostedStripeCheckout()) {
      // Explicit demo only — never silently skip the payment gateway in production.
      if (process.env.SELFPACED_STRIPE_DEMO === "1") {
        return NextResponse.json({
          url: `${origin}/selfpaced/success?slug=${encodeURIComponent(program.slug)}&demo=1&programId=${encodeURIComponent(program.id)}&amount=${program.priceCad}`,
          mode: "demo",
          demo: true,
          programId: program.id,
          programSlug: program.slug,
          priceCad: program.priceCad,
        });
      }
      return NextResponse.json(
        {
          error:
            "Stripe Checkout is not configured. Set a real STRIPE_SECRET_KEY=sk_test_… from https://dashboard.stripe.com/test/apikeys",
          code: "STRIPE_KEY_REQUIRED",
        },
        { status: 503 },
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      locale: "en",
      billing_address_collection: "required",
      // Prefer Canada for Heritage programs (learner can still change country).
      shipping_address_collection: undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "cad",
            unit_amount: Math.round(program.priceCad * 100),
            product_data: {
              name: program.title,
              description: `${program.subject} · ${program.level} · Self-paced eLearning (one chapter per day)`,
              images: program.image.startsWith("http") ? [program.image] : undefined,
            },
          },
        },
      ],
      success_url: `${origin}/selfpaced/success?session_id={CHECKOUT_SESSION_ID}&slug=${encodeURIComponent(program.slug)}&programId=${encodeURIComponent(program.id)}&amount=${program.priceCad}`,
      cancel_url: `${origin}/selfpaced/programs/${program.slug}?canceled=1`,
      metadata: {
        programId: program.id,
        programSlug: program.slug,
        priceCad: String(program.priceCad),
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 });
    }

    return NextResponse.json({
      url: session.url,
      mode: "stripe_hosted",
      programId: program.id,
      programSlug: program.slug,
      priceCad: program.priceCad,
    });
  } catch (err) {
    console.error("selfpaced checkout", err);
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json(
      {
        error: message.includes("Invalid API Key")
          ? "Invalid Stripe secret key. Paste a real sk_test_… from the Stripe Dashboard (Test mode)."
          : message,
        code: "STRIPE_ERROR",
      },
      { status: 500 },
    );
  }
}
