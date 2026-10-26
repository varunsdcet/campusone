"use client";

import { Suspense } from "react";
import { SuperStudentSearch } from "@/components/superadmin/StudentSearch";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuperStudentSearch />
    </Suspense>
  );
}
