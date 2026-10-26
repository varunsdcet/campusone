"use client";

import { Suspense } from "react";
import { UserRequestsList } from "@/components/requests/UserRequests";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <UserRequestsList />
    </Suspense>
  );
}
