"use client";

import { Suspense } from "react";
import { ProgramManagement } from "@/components/programs/ProgramManagement";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProgramManagement />
    </Suspense>
  );
}
