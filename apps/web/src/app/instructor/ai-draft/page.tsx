"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AiDraftCoursePicker } from "@/components/ai-draft/AiDraftCoursePicker";
import { TeacherSisShell } from "@/components/TeacherSisShell";
import { loadSession } from "@/lib/api";

export default function AiDraftPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    if (!s.roles.includes("instructor")) {
      router.replace("/login");
      return;
    }
    setUserName(`${s.givenName} ${s.familyName}`.trim());
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <TeacherSisShell
      title="AI Draft"
      subtitle="Generate lessons & narrated slideshow videos"
      activeHref="/instructor/ai-draft"
      userName={userName}
    >
      <AiDraftCoursePicker />
    </TeacherSisShell>
  );
}
