"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, loadSession } from "@/lib/api";

/** Demo path redirects to the first live enrolled course, or the courses list. */
export default function StudentCourseDemoRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    api<{ items: Array<{ sectionId: string }> }>("/courses/me", {}, s.accessToken)
      .then((res) => {
        const first = res.items?.[0]?.sectionId;
        router.replace(first ? `/student/courses/${first}` : "/student/courses");
      })
      .catch(() => router.replace("/student/courses"));
  }, [router]);

  return <p style={{ color: "var(--mh-text-muted)", padding: 24 }}>Opening live course…</p>;
}
