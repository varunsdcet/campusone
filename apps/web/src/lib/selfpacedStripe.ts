/** Stripe test keys from env (Dashboard → Developers → API keys → Test mode). */
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

export const STRIPE_TEST_CARD = "4242 4242 4242 4242";

/** Only skip hosted Checkout when explicitly forced. */
export function useHostedStripeCheckout(): boolean {
  if (process.env.SELFPACED_STRIPE_DEMO === "1") return false;
  const secret = STRIPE_SECRET_KEY;
  if (!secret.startsWith("sk_test_") && !secret.startsWith("sk_live_")) return false;
  // Reject known placeholder / fake demo keys
  if (/heritage|demo00|replace|changeme|your.?key|000000000000/i.test(secret)) return false;
  return true;
}
