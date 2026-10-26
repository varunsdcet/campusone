"use client";

import { useEffect, useState } from "react";
import { api, loadSession } from "@/lib/api";

export type ModuleKey =
  | "systemConfiguration"
  | "userManagement"
  | "programManagement"
  | "courseManagement"
  | "locationManagement"
  | "studentRecords"
  | "facultyProfiles"
  | "agentManagement"
  | "housingManagement"
  | "financialManagement"
  | "userRequests"
  | "reporting"
  | "emailMessaging";

type Entry = {
  override: boolean;
  level: "full" | "read" | "none" | "custom";
  custom?: { view: boolean; create: boolean; edit: boolean; delete: boolean };
};

export type MyAccess = {
  accessLevelId: string | null;
  accessLevel: string | null;
  profileType: string | null;
  superAdmin: boolean;
  permissions: Record<ModuleKey, Entry>;
  campuses: string[];
};

let cache: { token: string; promise: Promise<MyAccess | null>; value?: MyAccess | null } | null = null;

export function fetchMyAccess(): Promise<MyAccess | null> {
  const session = loadSession();
  if (!session?.accessToken) return Promise.resolve(null);
  if (cache?.token === session.accessToken) return cache.promise;
  const entry: NonNullable<typeof cache> = {
    token: session.accessToken,
    promise: api<MyAccess>("/me/access", {}, session.accessToken, { skipAuthRedirect: true })
      .catch(() => null)
      .then((value) => {
        entry.value = value;
        return value;
      }),
  };
  cache = entry;
  return entry.promise;
}

function cachedAccess(): MyAccess | null | undefined {
  if (typeof window === "undefined" || !cache) return undefined;
  return cache.token === loadSession()?.accessToken ? cache.value : undefined;
}

export function resetMyAccess() {
  cache = null;
}

/** `undefined` while loading; `null` when access could not be resolved (nav stays unrestricted). */
export function useMyAccess() {
  const [access, setAccess] = useState<MyAccess | null | undefined>(cachedAccess);
  useEffect(() => {
    let cancelled = false;
    void fetchMyAccess().then((a) => {
      if (!cancelled) setAccess(a);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return access;
}

function viewable(entry: Entry | undefined) {
  if (!entry) return false;
  return entry.level === "full" || entry.level === "read" || (entry.level === "custom" && Boolean(entry.custom?.view));
}

function editable(entry: Entry | undefined) {
  if (!entry) return false;
  return entry.level === "full" || (entry.level === "custom" && Boolean(entry.custom?.create || entry.custom?.edit));
}

export type ModuleGate = { modules?: ModuleKey[]; edit?: boolean };

export function allows(access: MyAccess | null | undefined, gate: ModuleGate | undefined) {
  if (!gate?.modules?.length) return true;
  if (access === null) return true;
  if (access === undefined) return false;
  const check = gate.edit ? editable : viewable;
  return gate.modules.some((m) => check(access.permissions[m]));
}

export function NoModuleAccess() {
  return (
    <div className="mh-noaccess" role="alert">
      <strong>You do not have access to this section.</strong>
      <p>Your access level does not include this module. Contact your administrator if you need it.</p>
    </div>
  );
}
