"use client";

import { Suspense } from "react";
import { WorkshopsManage } from "@/components/workshops/WorkshopManage";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WorkshopsManage />
    </Suspense>
  );
}
