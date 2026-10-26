"use client";

import { useEffect, useState } from "react";
import { allows, useMyAccess, type ModuleKey } from "@/lib/access";
import { api, loadSession } from "@/lib/api";

const REFRESH_EVENT = "mh:nav-counts";

type RequestCounts = { total: number; byType: Record<string, number> };
type WorkshopCounts = { pending: number; approved: number; declined: number; available: number; completed: number };

/** Live sidebar badge values keyed by `AdminNavChild.count` / `AdminNavItem.count`. */
export function useNavCounts(enabled: boolean, pathname: string) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const access = useMyAccess();
  useEffect(() => {
    if (!enabled || access === undefined) return;
    let cancelled = false;
    const load = () => {
      const token = loadSession()?.accessToken;
      if (!token) return;
      const quiet = { skipAuthRedirect: true };
      /* Each endpoint asserts view access on its module; skip the ones that would 403. */
      const get = <T,>(path: string, module: ModuleKey) =>
        allows(access, { modules: [module] }) ? api<T>(path, {}, token, quiet) : Promise.reject(new Error(`No ${module} access`));
      void Promise.allSettled([
        get<RequestCounts>("/admin/heritage/requests/counts", "userRequests"),
        get<WorkshopCounts>("/admin/heritage/workshops/counts", "courseManagement"),
        get<{ gradesSubmission: number }>("/admin/heritage/my-courses/counts", "courseManagement"),
        get<{ pending: number; backups: number }>("/admin/heritage/courses/counts", "courseManagement"),
        get<Record<string, number>>("/admin/heritage/students/counts", "studentRecords"),
      ]).then(([requests, workshops, myCourses, courses, students]) => {
        if (cancelled) return;
        const next: Record<string, number> = {};
        if (requests.status === "fulfilled") {
          next.requests = requests.value.total;
          for (const [type, n] of Object.entries(requests.value.byType)) next[`requests:${type}`] = n;
        }
        if (workshops.status === "fulfilled") {
          for (const [key, n] of Object.entries(workshops.value)) next[`workshops:${key}`] = n;
        }
        if (myCourses.status === "fulfilled") next["my-courses:gradesSubmission"] = myCourses.value.gradesSubmission;
        if (courses.status === "fulfilled") {
          next["courses:pending"] = courses.value.pending;
          next["courses:backups"] = courses.value.backups;
        }
        if (students.status === "fulfilled") Object.assign(next, students.value);
        setCounts(next);
      });
    };
    load();
    window.addEventListener(REFRESH_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(REFRESH_EVENT, load);
    };
  }, [enabled, pathname, access]);
  return counts;
}

export function refreshNavCounts() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(REFRESH_EVENT));
}
