import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../../app/ServicesProvider';
import { useCurrentUserId } from '../../../state/sessionStore';

export function useFeePayments() {
  const s = useServices();
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const svc = s.feePayments;
  const enabled = useQuery({ queryKey: ['feePaymentsEnabled', userId], queryFn: () => svc!.enabled(), enabled: !!svc, staleTime: 5 * 60_000 });
  const start = useMutation({ mutationFn: (amountCad?: number) => svc!.startCheckout(amountCad) });
  const confirm = useMutation({
    mutationFn: (sessionId: string) => svc!.confirm(sessionId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['statements'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  return { supported: !!svc && enabled.data === true, start, confirm };
}
