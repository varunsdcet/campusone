"use client";

import { Suspense } from "react";
import { MinistryForm } from "@/components/location/Places";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MinistryForm mode="create" />
    </Suspense>
  );
}
