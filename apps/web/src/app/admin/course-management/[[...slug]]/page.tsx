"use client";

import { Suspense } from "react";
import { CourseManagement } from "@/components/courses/CourseManagement";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CourseManagement />
    </Suspense>
  );
}
