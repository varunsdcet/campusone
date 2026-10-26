"use client";

import { Suspense } from "react";
import { GenericForm } from "@/components/sysconfig/screens";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GenericForm mode="edit" />
    </Suspense>
  );
}
