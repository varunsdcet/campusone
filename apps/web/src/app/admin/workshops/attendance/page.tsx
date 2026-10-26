"use client";

import { Suspense } from "react";
import { WorkshopAttendance } from "@/components/workshops/WorkshopAttendance";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WorkshopAttendance />
    </Suspense>
  );
}
