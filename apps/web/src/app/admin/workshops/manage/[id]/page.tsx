"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { WorkshopView } from "@/components/workshops/WorkshopManage";

function Screen() {
  const params = useParams<{ id: string }>();
  return <WorkshopView key={params.id} id={params.id} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  );
}
