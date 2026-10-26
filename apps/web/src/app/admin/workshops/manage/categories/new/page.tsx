"use client";

import { Suspense } from "react";
import { WorkshopCategoryForm } from "@/components/workshops/WorkshopManage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WorkshopCategoryForm />
    </Suspense>
  );
}
