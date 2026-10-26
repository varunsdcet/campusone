"use client";

import { Suspense } from "react";
import { ClassroomForm } from "@/components/location/Campuses";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClassroomForm mode="create" />
    </Suspense>
  );
}
