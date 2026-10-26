"use client";

import { Suspense } from "react";
import { WorkshopEnrolmentsList } from "@/components/workshops/WorkshopEnrolments";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WorkshopEnrolmentsList />
    </Suspense>
  );
}
