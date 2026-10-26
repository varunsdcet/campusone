"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SuperFrame } from "@/components/superadmin/shared";
import { HccMailViews } from "@/components/HccMailViews";
import { loadSession } from "@/lib/api";

export default function AdminMessagesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loadSession()) {
      router.replace("/login?next=%2Fadmin%2Fmessages");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <HccMailViews
      role="admin"
      shell={({ title, children }) => (
        <SuperFrame title={`My E-mail / Messages — ${title}`} breadcrumbs={["Home", "My E-mail / Messages", title]} activeHref="/admin/messages">
          {children}
        </SuperFrame>
      )}
    />
  );
}
