"use client";

import { Suspense } from "react";
import { CourseAttendance } from "@/components/mycourses/CourseAttendance";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CourseAttendance />
    </Suspense>
  );
}
