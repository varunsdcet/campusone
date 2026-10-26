"use client";

import { Suspense } from "react";
import { NewWorkshopEnrolment } from "@/components/workshops/WorkshopEnrolments";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NewWorkshopEnrolment />
    </Suspense>
  );
}
