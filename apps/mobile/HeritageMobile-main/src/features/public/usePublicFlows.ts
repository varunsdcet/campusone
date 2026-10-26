import { useMutation, useQuery } from '@tanstack/react-query';
import { useServices } from '../../app/ServicesProvider';
import { ServiceError } from '../../services/errors';
import type { PublicFlowsService } from '../../services/contracts/publicFlows';

/** The signed-out flows only exist against the live API; the Login screen hides their entry points otherwise. */
export function usePublicFlowsAvailable() {
  return !!useServices().publicFlows;
}

function usePublicFlows(): () => PublicFlowsService {
  const services = useServices();
  return () => {
    if (!services.publicFlows) throw new ServiceError('NOT_CONFIGURED', 'This is only available when connected to Campus One.', { retryable: false });
    return services.publicFlows;
  };
}

export function useSelfpacedPrograms() {
  const flows = usePublicFlows();
  return useQuery({ queryKey: ['public', 'selfpaced', 'programs'], queryFn: () => flows().listSelfpacedPrograms() });
}

export function useSelfpacedProgram(slug: string) {
  const flows = usePublicFlows();
  return useQuery({ queryKey: ['public', 'selfpaced', 'program', slug], queryFn: () => flows().getSelfpacedProgram(slug) });
}

export function useApply() {
  const flows = usePublicFlows();
  return useMutation({ mutationFn: (input: Parameters<PublicFlowsService['apply']>[0]) => flows().apply(input) });
}

export function useRegisterEnglishTest() {
  const flows = usePublicFlows();
  return useMutation({ mutationFn: (input: Parameters<PublicFlowsService['registerEnglishTest']>[0]) => flows().registerEnglishTest(input) });
}

export function useRegisterSelfpaced() {
  const flows = usePublicFlows();
  return useMutation({ mutationFn: (input: Parameters<PublicFlowsService['registerSelfpacedLearner']>[0]) => flows().registerSelfpacedLearner(input) });
}