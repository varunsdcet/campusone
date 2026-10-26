"use client";

import { Suspense } from "react";
import { SuperFacultyProfile } from "@/components/superadmin/FacultyProfile";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuperFacultyProfile tab="biography" />
    </Suspense>
  );
}
