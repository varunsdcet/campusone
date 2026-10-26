"use client";

import { Suspense } from "react";
import { StudentManagement } from "@/components/students/StudentManagement";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StudentManagement />
    </Suspense>
  );
}
