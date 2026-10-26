"use client";

import { Suspense } from "react";
import { MyCoursesSchedule } from "@/components/mycourses/MyCoursesScreens";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MyCoursesSchedule />
    </Suspense>
  );
}
