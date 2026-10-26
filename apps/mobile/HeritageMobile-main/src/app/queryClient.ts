import { QueryClient } from '@tanstack/react-query';
import { ServiceError } from '../services/errors';

/**
 * Query cache is a derived view over the mock repository. Mutations invalidate
 * keys; the repository itself remains the source of truth. Network status is
 * ignored in mock mode so airplane mode never disables local demo operations.
 */
export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'always',
        retry: (count, error) => (ServiceError.is(error) ? error.retryable && count < 1 : count < 1),
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
      mutations: { networkMode: 'always', retry: 0 },
    },
  });
}
