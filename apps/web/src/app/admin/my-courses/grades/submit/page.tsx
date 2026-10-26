"use client";

import { Suspense } from "react";
import { GradeSubmit } from "@/components/mycourses/GradeSubmit";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GradeSubmit />
    </Suspense>
  );
}
