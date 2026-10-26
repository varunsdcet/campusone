"use client";

import { Suspense } from "react";
import { StudentSearchView } from "@/components/StudentFunctionalViews";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StudentSearchView />
    </Suspense>
  );
}
