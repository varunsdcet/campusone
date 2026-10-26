"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { UserRequestEdit } from "@/components/requests/UserRequests";

function Screen() {
  const params = useParams<{ number: string }>();
  return <UserRequestEdit key={params.number} number={Number(params.number)} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  );
}
