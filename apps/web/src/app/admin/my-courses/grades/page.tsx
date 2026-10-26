"use client";

import { Suspense } from "react";
import { MyGradesSubmission } from "@/components/mycourses/MyCoursesScreens";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MyGradesSubmission />
    </Suspense>
  );
}
