import { appConfig } from '../../config/appConfig';
import { ServiceError, type ServiceErrorCode } from '../errors';
import { useUiStore } from '../../state/uiStore';
import type { KeyValueStore } from '../../storage/asyncStorage';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface StoredSession {
  accessToken: string;
  accountId: string;
  rememberMe: boolean;
  createdAt: string;
}

const SESSION_KEY = 'campusone.session.v1';

function codeFor(status: number): ServiceErrorCode {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'PERMISSION_DENIED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 400 || status === 422) return 'VALIDATION';
  return 'SERVER';
}

function messageFrom(json: unknown, status: number): { message: string; details?: Record<string, string> } {
  const err = (json as { error?: { message?: string; details?: unknown } } | undefined)?.error;
  let details: Record<string, string> | undefined;
  if (Array.isArray(err?.details)) {
    details = {};
    for (const issue of err!.details as { path?: (string | number)[]; message?: string }[]) {
      const key = issue.path?.join('.') || 'form';
      if (issue.message && !details[key]) details[key] = issue.message;
    }
  }
  const first = details ? Object.values(details)[0] : undefined;
  const candidate = (typeof err === 'string' ? err : err?.message) ?? (typeof json === 'string' ? json : undefined);
  // Express/nginx error pages must never be rendered as user-facing copy.
  const raw = candidate && /<\s*(?:!doctype|html|head|body|pre)\b/i.test(candidate) ? undefined : candidate;
  const fallback = status === 404
    ? 'This feature is not available right now.'
    : status >= 500
      ? 'Campus One could not complete this request. Please try again.'
      : `Request failed (${status})`;
  const message = raw && raw !== 'Validation failed' ? raw : first ?? raw ?? fallback;
  return { message, details };
}

/**
 * HTTP client for the Heritage API. Holds the bearer token in memory and
 * persists it (only when "Remember me" is on) so the session survives restarts.
 */
export class ApiClient {
  private session: StoredSession | null = null;
  private onUnauthorized: (() => void) | null = null;

  constructor(private readonly store: KeyValueStore) {}

  get baseUrl(): string {
    if (!appConfig.apiBaseUrl) throw new ServiceError('NOT_CONFIGURED', 'apiBaseUrl is not configured.');
    return appConfig.apiBaseUrl;
  }

  get token(): string | undefined {
    return this.session?.accessToken;
  }

  get accountId(): string | undefined {
    return this.session?.accountId;
  }

  setUnauthorizedHandler(fn: (() => void) | null) {
    this.onUnauthorized = fn;
  }

  async setSession(session: StoredSession) {
    this.session = session;
    if (session.rememberMe) await this.store.setItem(SESSION_KEY, JSON.stringify(session));
    else await this.store.removeItem(SESSION_KEY);
  }

  async loadSession(): Promise<StoredSession | null> {
    const raw = await this.store.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      this.session = JSON.parse(raw) as StoredSession;
      return this.session;
    } catch {
      return null;
    }
  }

  async clearSession() {
    this.session = null;
    await this.store.removeItem(SESSION_KEY);
  }

  /** Absolute URL for an API path (e.g. a PDF download). */
  url(path: string): string {
    return /^https?:\/\//.test(path) ? path : `${this.baseUrl}${path}`;
  }

  /** Absolute URL for a web asset path returned by the API (e.g. `/brand/...`). */
  assetUrl(path: string | null | undefined): string | undefined {
    if (!path) return undefined;
    if (/^https?:\/\//.test(path)) return path;
    return `${appConfig.webOrigin ?? ''}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  authHeaders(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  async request<T>(method: Method, path: string, body?: unknown, opts: { auth?: boolean; timeoutMs?: number; headers?: Record<string, string>; suppressUnauthorizedHandler?: boolean } = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? appConfig.apiTimeoutMs);
    try {
      const res = await fetch(this.url(path), {
        method,
        headers: {
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(opts.auth === false ? {} : this.authHeaders()),
          ...opts.headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      useUiStore.getState().setOffline(false);
      const text = await res.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        json = text;
      }
      if (!res.ok) {
        const { message, details } = messageFrom(json, res.status);
        if (res.status === 401 && opts.auth !== false && !opts.suppressUnauthorizedHandler && this.session) this.onUnauthorized?.();
        throw new ServiceError(codeFor(res.status), message, { details });
      }
      return json as T;
    } catch (e) {
      if (e instanceof ServiceError) throw e;
      if ((e as Error).name === 'AbortError') throw new ServiceError('TIMEOUT', 'The request timed out. Check your connection and try again.');
      useUiStore.getState().setOffline(true);
      throw new ServiceError('NETWORK', 'Could not reach Campus One. Check your internet connection and try again.');
    } finally {
      clearTimeout(timer);
    }
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }
  post<T>(path: string, body: unknown = {}, headers?: Record<string, string>) {
    return this.request<T>('POST', path, body, { headers });
  }
  put<T>(path: string, body: unknown = {}) {
    return this.request<T>('PUT', path, body);
  }
  patch<T>(path: string, body: unknown = {}) {
    return this.request<T>('PATCH', path, body);
  }
  del<T>(path: string) {
    return this.request<T>('DELETE', path);
  }
}

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
};
