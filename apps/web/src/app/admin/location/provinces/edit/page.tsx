"use client";

import { Suspense } from "react";
import { ProvinceForm } from "@/components/location/Places";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProvinceForm mode="edit" />
    </Suspense>
  );
}
