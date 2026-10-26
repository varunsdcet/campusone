"use client";

import { useEffect, useState } from "react";
import { api, loadSession } from "@/lib/api";
import type { AdminNavChild, AdminSidebarEntry } from "./adminNav";

/** The offering's own workspace (Course, Class List, Attendance, Grades) in Course Management. */
export const offeringHref = (sectionId: string) => `/admin/course-management/active/view?${new URLSearchParams({ id: sectionId }).toString()}`;

export type MyCoursesNav = {
  instructor: boolean;
  activeCourses: Array<{ id: string; courseId: string; code: string; offering: string; title: string }>;
};

export const MY_COURSES_LABEL = "My Courses";

/** Sidebar data for the signed-in person's own teaching (empty for admins who teach nothing). */
export function useMyCoursesNav(enabled: boolean, pathname: string) {
  const [nav, setNav] = useState<MyCoursesNav | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const token = loadSession()?.accessToken;
    if (!token) return;
    let cancelled = false;
    api<MyCoursesNav>("/admin/heritage/my-courses/nav", {}, token, { skipAuthRedirect: true })
      .then((r) => {
        if (!cancelled) setNav(r);
      })
      .catch(() => {
        if (!cancelled) setNav(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, pathname]);
  return nav;
}

/**
 * A caller who teaches sees ACTIVE COURSES (one link per offering, never merged by course code)
 * above a MISCELLANEOUS block that adds Course Evaluations; everyone else keeps the six Super Admin items.
 */
export function withMyCourses(sidebar: AdminSidebarEntry[], nav: MyCoursesNav | null): AdminSidebarEntry[] {
  if (!nav?.instructor) return sidebar;
  return sidebar.map((entry) => {
    if (entry.type !== "item" || entry.item.label !== MY_COURSES_LABEL || !entry.item.children) return entry;
    const active: AdminNavChild[] = nav.activeCourses.map((c, i) => ({
      label: `${c.code} (${c.offering}) — ${c.title}`,
      href: offeringHref(c.id),
      section: "ACTIVE COURSES",
      ...(i === 0 ? { subheading: "Instructor" } : {}),
    }));
    const misc: AdminNavChild[] = [];
    for (const child of entry.item.children) {
      misc.push({ ...child, section: "MISCELLANEOUS" });
      if (child.href === "/admin/my-courses") misc.push({ label: "Course Evaluations", href: "/admin/my-courses/evaluations", section: "MISCELLANEOUS" });
    }
    return { ...entry, item: { ...entry.item, children: [...active, ...misc] } };
  });
}
