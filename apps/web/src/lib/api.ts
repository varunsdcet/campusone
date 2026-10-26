export const API_URL =
  process.env.NEXT_PUBLIC_API_URL !== undefined && process.env.NEXT_PUBLIC_API_URL !== ""
    ? process.env.NEXT_PUBLIC_API_URL
    : typeof window !== "undefined"
      ? "/__api"
      : "http://127.0.0.1:4000";

export type Session = {
  accessToken: string;
  accountId: string;
  personId: string;
  institutionId: string;
  roles: string[];
  givenName: string;
  familyName: string;
  accountStatus?: "active" | "paused";
  pauseGate?: boolean;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const KEY_SESSION = "mh.session.ephemeral";

function tokenExpired(accessToken: string): boolean {
  try {
    const part = accessToken.split(".")[1];
    if (!part) return true;
    const padded = part.replace(/-/g, "+").replace(/_/g, "/") + "==".slice((part.length * 3) % 4);
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    // 30s skew so clock drift does not bounce a fresh login.
    return Date.now() >= payload.exp * 1000 - 30_000;
  } catch {
    // Do not wipe a fresh session because of a decode glitch.
    return false;
  }
}

export function saveSession(session: Session, remember = true) {
  const raw = JSON.stringify(session);
  if (typeof window === "undefined") return;
  // Bearer tokens never enter localStorage. The server owns the signed, httpOnly portal cookie;
  // this tab-scoped copy only supplies Authorization headers to the API client.
  void remember;
  sessionStorage.setItem(KEY_SESSION, raw);
}

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY_SESSION);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    if (!session.accessToken || tokenExpired(session.accessToken)) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(KEY_SESSION);
}

/** Revokes the server session (best-effort) before clearing local session state. */
export async function logout(): Promise<void> {
  if (typeof window === "undefined") return;
  const raw = sessionStorage.getItem(KEY_SESSION);
  let accessToken: string | undefined;
  try {
    accessToken = raw ? (JSON.parse(raw) as Session).accessToken : undefined;
  } catch {
    accessToken = undefined;
  }
  if (accessToken) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4000);
    try {
      await fetch(`${API_URL.replace(/\/$/, "")}/auth/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: "{}",
        keepalive: true,
        credentials: "include",
        signal: controller.signal,
      });
    } catch {
      /* best-effort: local session is cleared regardless */
    } finally {
      window.clearTimeout(timer);
    }
  }
  clearSession();
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
  opts?: { skipAuthRedirect?: boolean },
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const base = API_URL.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, { ...init, headers, credentials: init.credentials ?? "include" });
  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string }; message?: string };
      message = body.error?.message ?? body.message ?? message;
      code = body.error?.code;
    } catch {
      try {
        message = await res.text();
      } catch {
        /* ignore */
      }
    }
    if (res.status === 401 && !opts?.skipAuthRedirect) {
      clearSession();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`/login?next=${next}`);
      }
    }
    throw new ApiError(message || `Request failed (${res.status})`, res.status, code);
  }
  return res.json() as Promise<T>;
}

export async function fetchAuthenticatedBlob(path: string, token: string): Promise<{ blob: Blob; filename: string | null }> {
  const headers = new Headers();
  headers.set("authorization", `Bearer ${token}`);
  const base = API_URL.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, { headers });
  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string }; message?: string };
      message = body.error?.message ?? body.message ?? message;
      code = body.error?.code;
    } catch {
      try {
        message = await res.text();
      } catch {
        /* ignore */
      }
    }
    if (res.status === 401) {
      clearSession();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`/login?next=${next}`);
      }
    }
    throw new ApiError(message || `Request failed (${res.status})`, res.status, code);
  }
  const cd = res.headers.get("content-disposition");
  const filename = cd?.match(/filename\*?=(?:UTF-8''|")?([^\";]+)"?/i)?.[1] ?? null;
  return { blob: await res.blob(), filename: filename ? decodeURIComponent(filename) : null };
}

function triggerBlobDownload(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noreferrer";
  a.click();
}

export async function openAuthenticatedPdf(path: string, token: string, fallbackName: string, existingPreview?: Window | null) {
  if (path.startsWith("https://")) {
    existingPreview?.close();
    window.open(path, "_blank", "noopener,noreferrer");
    return;
  }
  const preview = existingPreview && !existingPreview.closed ? existingPreview : window.open("about:blank", "_blank");
  try {
    const { blob, filename } = await fetchAuthenticatedBlob(path, token);
    const url = URL.createObjectURL(blob);
    const name = filename || fallbackName;
    let opened = false;
    if (preview && !preview.closed) {
      try {
        preview.document.open();
        preview.document.write(
          `<!doctype html><html><head><title>${name.replace(/[<>&"]/g, "")}</title><style>html,body{margin:0;height:100%;background:#525659}</style></head><body><embed src="${url}" type="application/pdf" style="width:100%;height:100%;border:0" /></body></html>`,
        );
        preview.document.close();
        opened = true;
      } catch {
        try {
          preview.location.href = url;
          opened = true;
        } catch {
          preview.close();
        }
      }
    }
    if (!opened) triggerBlobDownload(url, name);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    preview?.close();
    throw err;
  }
}
