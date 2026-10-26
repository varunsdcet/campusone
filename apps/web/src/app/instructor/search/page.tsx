"use client";

import { Suspense } from "react";
import { InstructorSearchView } from "@/components/InstructorSearchView";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading search…</div>}>
      <InstructorSearchView />
    </Suspense>
  );
}
