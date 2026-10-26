export interface FeeCheckout {
  url: string;
  sessionId: string;
  amountCad: number;
  /** Stripe redirects here after payment (with `session_id`); the app intercepts it. */
  successUrl: string;
  cancelUrl: string;
}

export interface FeePaymentReceipt {
  entryId: string;
  number: number;
  amountCad: number;
  alreadyRecorded: boolean;
}

export interface FeePaymentsService {
  /** Whether the institution accepts online card payments for fees. */
  enabled(): Promise<boolean>;
  /** Starts a Stripe hosted checkout for the account balance (or part of it). */
  startCheckout(amountCad?: number): Promise<FeeCheckout>;
  /** Records a completed checkout on the student ledger; safe to call more than once. */
  confirm(sessionId: string): Promise<FeePaymentReceipt>;
}
