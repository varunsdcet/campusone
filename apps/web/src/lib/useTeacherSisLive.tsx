"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, loadSession } from "@/lib/api";
import type { TeacherScreenConfig } from "@/lib/teacherCatalog";

type TeacherLiveResponse = {
  path: string;
  live: true;
  source: "domain";
  bootstrap?: {
    displayName: string;
    email: string;
    studentCount: number;
    sectionCount: number;
    courseCount: number;
    draftGradeCount: number;
    unreadNotifications: number;
    workshopCounts?: {
    pending?: number;
    approved?: number;
    declined?: number;
    available?: number;
    completed?: number;
  };
  statusCounts?: Record<string, number>;
  flagCount?: number;
  alertCount?: number;
};
  payload: Partial<TeacherScreenConfig> & Record<string, unknown>;
  ok?: boolean;
  action?: string;
  message?: string;
};

type TeacherLiveContextValue = {
  path: string;
  loading: boolean;
  error: string | null;
  source: string | null;
  busy: boolean;
  toast: string | null;
  bootstrap: TeacherLiveResponse["bootstrap"] | null;
  refresh: () => Promise<void>;
  runAction: (action: string, rowKey?: string) => Promise<boolean>;
};

const TeacherLiveContext = createContext<TeacherLiveContextValue | null>(null);

const SCREEN_TIMEOUT_MS = 30_000;

/**
 * Only layout/chrome from catalog is kept.
 * Every data field must come from `/instructor/sis/screen` — never catalog fixtures.
 */
const CHROME_KEYS = new Set([
  "path",
  "figmaId",
  "title",
  "subtitle",
  "breadcrumbs",
  "activeHref",
  "archetype",
  "shell",
  "primaryAction",
  "primaryActionHref",
  "secondaryAction",
  "secondaryActionHref",
  "searchPlaceholder",
  "filters",
  "columns",
  "columnTemplate",
]);

/** Data sections whose catalog copy is a fixture: when live omits them, only the screen title/subtitle chrome is kept. */
const DATA_SECTIONS = [
  "activeCourses",
  "courseList",
  "programDirectory",
  "facultiesPrograms",
  "programSettings",
  "courseConfigurations",
  "courseHistory",
  "gradingSchemes",
  "programTypes",
  "courseTypes",
  "manageTerms",
  "reviewTerm",
  "scheduleManage",
  "coursesSessions",
  "courseAdmin",
  "masterScheduling",
  "academicCalendars",
  "courseTextbooks",
  "contentRepository",
] as const;

function chromeOnly(chrome: TeacherScreenConfig, loading: boolean): TeacherScreenConfig {
  const out: Record<string, unknown> = {
    rows: [],
    kpis: [],
    countLabel: loading ? "Loading…" : "0 records",
  };
  for (const key of CHROME_KEYS) {
    const value = (chrome as unknown as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = value;
  }
  if (loading) out.subtitle = "Loading live data…";
  return out as unknown as TeacherScreenConfig;
}

function mergeForm(
  chromeForm: TeacherScreenConfig["form"] | undefined,
  liveForm: TeacherScreenConfig["form"] | undefined,
): TeacherScreenConfig["form"] | undefined {
  const liveHasFields = Boolean(liveForm?.groups?.some((g) => g.fields.length > 0));
  if (liveHasFields) return liveForm;
  return chromeForm ?? liveForm;
}

function mergeHelpSupport(
  chromeHelp: TeacherScreenConfig["helpSupport"] | undefined,
  liveHelp: TeacherScreenConfig["helpSupport"] | undefined,
): TeacherScreenConfig["helpSupport"] | undefined {
  if (!chromeHelp) return liveHelp;
  if (!liveHelp) return chromeHelp;
  return {
    ...chromeHelp,
    ...liveHelp,
    topics: liveHelp.topics?.length ? liveHelp.topics : chromeHelp.topics,
    references: liveHelp.references?.length ? liveHelp.references : chromeHelp.references,
    tickets: liveHelp.tickets ?? chromeHelp.tickets,
    contacts: liveHelp.contacts?.length ? liveHelp.contacts : chromeHelp.contacts,
    hours: liveHelp.hours || chromeHelp.hours,
    aiReply: liveHelp.aiReply ?? chromeHelp.aiReply ?? null,
  };
}

export function mergeTeacherLive(
  chrome: TeacherScreenConfig,
  payload: Partial<TeacherScreenConfig> | null | undefined,
  loading: boolean,
): TeacherScreenConfig {
  const base = chromeOnly(chrome, loading);
  if (!payload) {
    const form = mergeForm(chrome.form, undefined);
    if (form) (base as TeacherScreenConfig).form = form;
    if (chrome.courseMgmt) (base as TeacherScreenConfig).courseMgmt = chrome.courseMgmt;
    if (chrome.hub) (base as TeacherScreenConfig).hub = chrome.hub;
    if (loading) {
      base.title = "Loading section…";
      base.subtitle = "Loading live CampusOne course data…";
    } else {
      base.subtitle = "Live data could not be loaded. Refresh to try again.";
    }
    const helpSupport = mergeHelpSupport(chrome.helpSupport, undefined);
    if (helpSupport) (base as TeacherScreenConfig).helpSupport = helpSupport;
    return base;
  }

  const merged: Record<string, unknown> = { ...(base as unknown as Record<string, unknown>) };
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    // Live domain may switch archetype (e.g. HCC My Courses / Students screens).
    if (
      CHROME_KEYS.has(key) &&
      key !== "title" &&
      key !== "subtitle" &&
      key !== "primaryAction" &&
      key !== "primaryActionHref" &&
      key !== "archetype" &&
      key !== "breadcrumbs"
    ) {
      continue;
    }
    merged[key] = value;
  }
  const form = mergeForm(chrome.form, merged.form as TeacherScreenConfig["form"] | undefined);
  if (form) merged.form = form;
  // Navigation hubs (cards / tool links) are chrome structure, not data.
  if (!(merged as TeacherScreenConfig).courseMgmt && chrome.courseMgmt) {
    merged.courseMgmt = chrome.courseMgmt;
    if (chrome.archetype === "courseMgmt") {
      merged.title = chrome.title;
      if (!loading) merged.subtitle = chrome.subtitle;
    }
  }
  if (!(merged as TeacherScreenConfig).hub && chrome.hub) {
    merged.hub = chrome.hub;
    if (chrome.archetype === "hub") {
      merged.title = chrome.title;
      if (!loading) merged.subtitle = chrome.subtitle;
    }
  }
  for (const key of DATA_SECTIONS) {
    if (chrome.archetype === key && !merged[key]) {
      if (!merged.title || merged.title === "Instructor") merged.title = chrome.title;
    }
  }
  const helpSupport = mergeHelpSupport(chrome.helpSupport, merged.helpSupport as TeacherScreenConfig["helpSupport"] | undefined);
  if (helpSupport) {
    merged.helpSupport = helpSupport;
    if (chrome.archetype === "helpSupport") {
      const liveTitle = String(merged.title || "");
      if (!liveTitle || liveTitle === "Instructor") merged.title = chrome.title;
      if (!loading) {
        const liveSub = String(merged.subtitle || "");
        if (!liveSub || /· live$/i.test(liveSub)) merged.subtitle = chrome.subtitle;
      }
    }
  }
  return merged as unknown as TeacherScreenConfig;
}

export function TeacherLiveProvider({
  path,
  studentId,
  children,
}: {
  path: string;
  studentId?: string | null;
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [payload, setPayload] = useState<Partial<TeacherScreenConfig> | null>(null);
  const [bootstrap, setBootstrap] = useState<TeacherLiveResponse["bootstrap"] | null>(null);

  const refresh = useCallback(async () => {
    const session = loadSession();
    if (!session?.accessToken) {
      setError("Not signed in");
      setLoading(false);
      setPayload(null);
      return;
    }
    setLoading(true);
    setError(null);
    // Drop stale rows immediately so filter changes never show the previous result set.
    setPayload(null);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), SCREEN_TIMEOUT_MS);
    try {
      const qs = new URLSearchParams();
      qs.set("path", path);
      if (studentId) qs.set("studentId", studentId);
      const res = await api<TeacherLiveResponse>(
        `/instructor/sis/screen?${qs.toString()}`,
        { signal: controller.signal },
        session.accessToken,
      );
      setSource(res.source ?? "domain");
      setPayload(res.payload ?? null);
      setBootstrap(res.bootstrap ?? null);
    } catch (err) {
      setError(
        controller.signal.aborted
          ? "This page took too long to load. Refresh to try again."
          : err instanceof Error
            ? err.message
            : "Failed to load live data",
      );
      setPayload(null);
    } finally {
      window.clearTimeout(timer);
      setLoading(false);
    }
  }, [path, studentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = useCallback(
    async (action: string, rowKey?: string) => {
      const session = loadSession();
      if (!session?.accessToken) {
        setToast("Sign in required");
        return false;
      }
      setBusy(true);
      setToast(null);
      try {
        const res = await api<TeacherLiveResponse & { result?: { href?: string; download?: { filename?: string; mime?: string; content?: string } } }>(
          `/instructor/sis/action`,
          {
            method: "POST",
            body: JSON.stringify({ path, action, rowKey }),
          },
          session.accessToken,
        );
        setSource(res.source ?? "domain");
        if (res.payload) setPayload(res.payload);
        if (res.bootstrap) setBootstrap(res.bootstrap);
        const nextHref =
          typeof res.result?.href === "string" && res.result.href.startsWith("/")
            ? res.result.href
            : null;
        if (nextHref) {
          window.location.assign(nextHref);
          return true;
        }
        if (res.result?.download?.content != null) {
          const blob = new Blob([res.result.download.content], { type: res.result.download.mime || "text/plain" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = res.result.download.filename || "download.txt";
          anchor.click();
          URL.revokeObjectURL(url);
        }
        setToast(res.message || `Saved · ${action}`);
        window.setTimeout(() => setToast(null), 2800);
        return res.ok !== false;
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Action failed");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [path],
  );

  const value = useMemo(
    () => ({ path, loading, error, source, busy, toast, bootstrap, refresh, runAction }),
    [path, loading, error, source, busy, toast, bootstrap, refresh, runAction],
  );

  return (
    <TeacherLiveContext.Provider value={value}>
      <TeacherLivePayloadContext.Provider value={{ payload, loading }}>
        {children}
      </TeacherLivePayloadContext.Provider>
    </TeacherLiveContext.Provider>
  );
}

const TeacherLivePayloadContext = createContext<{
  payload: Partial<TeacherScreenConfig> | null;
  loading: boolean;
}>({ payload: null, loading: true });

export function useTeacherLive() {
  const ctx = useContext(TeacherLiveContext);
  if (!ctx) throw new Error("useTeacherLive requires TeacherLiveProvider");
  return ctx;
}

export function useTeacherLivePayload() {
  return useContext(TeacherLivePayloadContext);
}

export function useOptionalTeacherLive() {
  return useContext(TeacherLiveContext);
}
