"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { UserRequestReview } from "@/components/requests/UserRequests";

function Screen() {
  const params = useParams<{ number: string }>();
  return <UserRequestReview key={params.number} number={Number(params.number)} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  );
}
