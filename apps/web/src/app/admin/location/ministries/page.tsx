"use client";

import { Suspense } from "react";
import { ManageMinistries } from "@/components/location/Places";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ManageMinistries />
    </Suspense>
  );
}
