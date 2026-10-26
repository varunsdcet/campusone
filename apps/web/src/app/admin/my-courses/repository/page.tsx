"use client";

import { Suspense } from "react";
import { MyCourseRepository } from "@/components/mycourses/MyCoursesScreens";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MyCourseRepository />
    </Suspense>
  );
}
