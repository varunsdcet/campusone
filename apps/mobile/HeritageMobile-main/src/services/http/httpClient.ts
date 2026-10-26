import { appConfig } from '../../config/appConfig';
import { ServiceError } from '../errors';

/**
 * Minimal typed HTTP client for the future API adapter.
 * Not used while `appConfig.mode === 'mock'`.
 */
export interface HttpClient {
  request<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown, opts?: { token?: string }): Promise<T>;
}

export function createHttpClient(getToken: () => string | undefined): HttpClient {
  return {
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      if (!appConfig.apiBaseUrl) throw new ServiceError('NOT_CONFIGURED', 'apiBaseUrl is not configured.');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), appConfig.apiTimeoutMs);
      try {
        const res = await fetch(`${appConfig.apiBaseUrl}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
        const text = await res.text();
        const json = text ? (JSON.parse(text) as unknown) : undefined;
        if (!res.ok) {
          const err = (json as { error?: { code?: string; message?: string } })?.error;
          const code = res.status === 401 ? 'UNAUTHENTICATED' : res.status === 403 ? 'PERMISSION_DENIED' : res.status === 404 ? 'NOT_FOUND' : res.status === 409 ? 'CONFLICT' : res.status === 422 ? 'VALIDATION' : 'SERVER';
          throw new ServiceError(code, err?.message ?? `Request failed (${res.status})`);
        }
        return json as T;
      } catch (e) {
        if (e instanceof ServiceError) throw e;
        if ((e as Error).name === 'AbortError') throw new ServiceError('TIMEOUT', 'The request timed out.');
        throw new ServiceError('NETWORK', 'Network request failed.');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
