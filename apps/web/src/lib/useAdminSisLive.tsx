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
import type { SisScreenConfig } from "@/lib/adminSisCatalog";

type SisLiveResponse = {
  path: string;
  live: true;
  source: "domain" | "sis_state";
  payload: Partial<SisScreenConfig> & Record<string, unknown>;
};

type SisLiveContextValue = {
  path: string;
  loading: boolean;
  error: string | null;
  source: string | null;
  busy: boolean;
  toast: string | null;
  runAction: (action: string, rowKey?: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const SisLiveContext = createContext<SisLiveContextValue | null>(null);

const CHROME_KEYS = new Set([
  "path",
  "figmaId",
  "title",
  "subtitle",
  "breadcrumbs",
  "activeHref",
  "archetype",
  "primaryAction",
  "primaryActionHref",
  "secondaryAction",
  "secondaryActionHref",
  "secondaryActions",
  "secondaryActionHrefs",
  "platformNav",
  "labsNav",
  "aiNav",
  "complianceNav",
  "academicsNav",
  "searchPlaceholder",
  "columnTemplate",
  "hideRowAction",
  "rowHref",
  "workspacePanels",
]);

function emptyForArchetype(archetype: SisScreenConfig["archetype"]): Partial<SisScreenConfig> {
  switch (archetype) {
    case "detail":
      return {
        detail: {
          name: "…",
          meta: "Loading live campus record…",
          steps: [],
          tabs: ["Summary"],
          fields: [],
          checklist: [],
        },
      };
    case "registrarRecord":
      return {
        registrarRecord: {
          student: { name: "…", badge: "", id: "", program: "", admit: "", gpa: "", credits: "" },
          eyebrow: "Student record",
          pageTitle: "…",
        },
      };
    case "correction":
      return {
        correction: {
          eyebrow: "Correction",
          title: "Loading…",
          record: { id: "—", name: "—", type: "—" },
          before: { value: "—", label: "—" },
          after: { value: "—", label: "—" },
          reasonLabel: "Correction Reason",
          reasonPlaceholder: "Enter reason…",
          authorizer: { name: "—", role: "—" },
          notice: "Live campus authorization required.",
          applyLabel: "Save",
        },
      };
    case "profile360":
      return {
        profile360: {
          name: "…",
          meta: "Loading…",
          tabs: ["Overview"],
        },
      };
    case "case":
      return {
        caseDetail: {
          type: "Case",
          title: "Loading case…",
          status: "…",
          owner: "—",
          body: "Loading live campus case record…",
          outcome: "—",
          tabs: ["Details", "Actions", "Notes", "Timeline"],
        },
      };
    case "plan":
      return { planTasks: [] };
    case "appointments":
      return {
        appointments: {
          slots: [],
          student: "—",
          advisor: "—",
        },
      };
    case "lead360":
      return {
        lead360: {
          name: "…",
          meta: "Loading…",
          score: "—",
          steps: [],
          tabs: ["Activity"],
          fields: [],
          timeline: [],
        },
      };
    case "account":
      return {
        account: {
          name: "…",
          meta: "Loading…",
          balance: "—",
          dueNote: "—",
          planTitle: "Payment plan",
          planBody: "Loading live account…",
          tabs: ["Ledger Summary"],
          ledger: [],
        },
      };
    case "builder":
      return {
        builder: {
          paletteTitle: "Blocks",
          palette: [],
          canvasTitle: "Canvas",
          canvasFields: [],
          inspectorTitle: "Inspector",
          inspector: [],
        },
      };
    case "export":
      return {
        exportPanel: {
          eyebrow: "Campus export",
          configs: [],
          schema: [],
          history: [],
          deliveries: [],
        },
      };
    case "holds":
      return { holds: { rows: [], student: "—", releaseReason: "—" } };
    case "searchResults":
      return {
        searchResults: {
          query: "",
          resultCount: "0",
          tabs: [],
          results: [],
        },
      };
    default:
      return {};
  }
}

/** Catalog contributes chrome only (titles/nav). All data comes from the live API. */
function chromeOnly(chrome: SisScreenConfig): SisScreenConfig {
  const base: Record<string, unknown> = { archetype: chrome.archetype };
  for (const [key, value] of Object.entries(chrome)) {
    if (CHROME_KEYS.has(key)) base[key] = value;
  }
  return {
    ...(base as unknown as SisScreenConfig),
    rows: [],
    kpis: [],
    countLabel: undefined,
    ...emptyForArchetype(chrome.archetype),
  };
}

export function mergeSisLive(
  chrome: SisScreenConfig,
  payload: Partial<SisScreenConfig> | null | undefined,
): SisScreenConfig {
  const stripped = chromeOnly(chrome);
  if (!payload) {
    return {
      ...stripped,
      kpis: [{ label: "Status", value: "…", hint: "Loading live campus data", tone: "muted" }],
      countLabel: "Loading…",
    };
  }
  const merged: SisScreenConfig = { ...stripped };
  const target = merged as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(payload)) {
    if (CHROME_KEYS.has(key) || value === undefined || value === null) continue;
    const current = target[key];
    if (
      current &&
      typeof current === "object" &&
      !Array.isArray(current) &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      target[key] = { ...(current as Record<string, unknown>), ...(value as Record<string, unknown>) };
    } else {
      target[key] = value;
    }
  }
  return merged;
}

export function SisLiveProvider({
  path,
  children,
  onPayload,
}: {
  path: string;
  children: ReactNode;
  onPayload: (payload: Partial<SisScreenConfig> | null) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const session = loadSession();
    if (!session) {
      setError("Not signed in");
      onPayload(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const view = await api<SisLiveResponse>(
        `/admin/sis/screen?path=${encodeURIComponent(path)}`,
        {},
        session.accessToken,
      );
      setSource(view.source);
      onPayload(view.payload as Partial<SisScreenConfig>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load live data");
      onPayload(null);
    } finally {
      setLoading(false);
    }
  }, [path, onPayload]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = useCallback(
    async (action: string, rowKey?: string) => {
      const session = loadSession();
      if (!session) {
        setToast("Sign in required");
        return;
      }
      setBusy(true);
      setToast(null);
      try {
        const view = await api<SisLiveResponse>(
          `/admin/sis/action`,
          {
            method: "POST",
            body: JSON.stringify({ path, action, rowKey }),
          },
          session.accessToken,
        );
        setSource(view.source);
        onPayload(view.payload as Partial<SisScreenConfig>);
        setToast(`Saved · ${action}`);
        window.setTimeout(() => setToast(null), 2400);
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Action failed");
      } finally {
        setBusy(false);
      }
    },
    [path, onPayload],
  );

  const value = useMemo(
    () => ({ path, loading, error, source, busy, toast, runAction, refresh }),
    [path, loading, error, source, busy, toast, runAction, refresh],
  );

  return <SisLiveContext.Provider value={value}>{children}</SisLiveContext.Provider>;
}

export function useSisLive() {
  const ctx = useContext(SisLiveContext);
  if (!ctx) {
    return {
      path: "",
      loading: false,
      error: null,
      source: null,
      busy: false,
      toast: null,
      runAction: async () => undefined,
      refresh: async () => undefined,
    } satisfies SisLiveContextValue;
  }
  return ctx;
}
