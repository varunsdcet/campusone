"use client";

import { Suspense } from "react";
import { GenericList } from "@/components/sysconfig/screens";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GenericList />
    </Suspense>
  );
}
