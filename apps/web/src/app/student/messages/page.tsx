"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StudentFrame } from "@/components/StudentSisShell";
import { HccMailViews } from "@/components/HccMailViews";
import { loadSession } from "@/lib/api";

export default function StudentMessagesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <HccMailViews
      role="student"
      shell={({ title, subtitle, children }) => (
        <StudentFrame
          role="student"
          title={title}
          subtitle={subtitle}
          breadcrumb={["Student", "My E-mail / Messages"]}
          activeHref="/student/messages"
        >
          {children}
        </StudentFrame>
      )}
    />
  );
}
