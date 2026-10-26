"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { TeacherSisShell } from "@/components/TeacherSisShell";
import { HccMailViews } from "@/components/HccMailViews";
import { loadSession } from "@/lib/api";

export default function InstructorMessagesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [userName, setUserName] = useState("Instructor");

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setUserName(`${s.givenName} ${s.familyName}`);
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <HccMailViews
      role="instructor"
      shell={({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
        <TeacherSisShell
          title={title}
          subtitle={subtitle || "My E-mail / Messages"}
          activeHref="/instructor/messages"
          userName={userName}
        >
          {children}
        </TeacherSisShell>
      )}
    />
  );
}
