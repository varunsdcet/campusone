"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { StudentCourseDetailPremiumView } from "@/components/StudentCoursesPremium";

export default function Page() {
  const params = useParams<{ sectionId: string }>();
  const sectionId = params?.sectionId ?? "demo";
  return (
    <Suspense fallback={null}>
      <StudentCourseDetailPremiumView sectionId={sectionId} />
    </Suspense>
  );
}
