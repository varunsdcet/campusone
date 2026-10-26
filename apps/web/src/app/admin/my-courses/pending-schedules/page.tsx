"use client";

import { Suspense } from "react";
import { MyPendingSchedules } from "@/components/mycourses/MyCoursesScreens";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MyPendingSchedules />
    </Suspense>
  );
}
