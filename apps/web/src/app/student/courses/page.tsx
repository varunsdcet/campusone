"use client";

import { Suspense } from "react";
import { StudentCoursesPremiumView } from "@/components/StudentCoursesPremium";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StudentCoursesPremiumView />
    </Suspense>
  );
}
