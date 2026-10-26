"use client";

import { Suspense } from "react";
import { CampusCoach } from "@/components/CampusCoach";

export default function StudentAskPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading Ask CampusOne…</p>}>
      <CampusCoach role="student" contextPath="/student/ask" />
    </Suspense>
  );
}
