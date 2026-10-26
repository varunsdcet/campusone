import type { FeeCheckout, FeePaymentReceipt, FeePaymentsService } from '../contracts/feePayments';
import type { ApiClient } from './client';

export function createFeePaymentsApi(api: ApiClient, onPaid: () => void): { feePayments: FeePaymentsService } {
  return {
    feePayments: {
      async enabled() {
        const f = await api.get<{ summary: { paymentExecutionEnabled?: boolean } }>('/student/finance');
        return Boolean(f.summary.paymentExecutionEnabled);
      },
      startCheckout(amountCad) {
        return api.post<FeeCheckout>('/student/finance/checkout', amountCad === undefined ? {} : { amountCad });
      },
      async confirm(sessionId) {
        const receipt = await api.post<FeePaymentReceipt>('/student/finance/checkout/confirm', { sessionId });
        onPaid();
        return receipt;
      },
    },
  };
}
