"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, loadSession } from "@/lib/api";
import { StudentAssignmentDetailView, StudentAssignmentsView } from "@/components/StudentFunctionalViews";

/** Figma ST-05 path — prefer live assignment detail when the student has work. */
export default function Page() {
  const router = useRouter();
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!session.roles.includes("student")) {
      setReady(true);
      return;
    }
    void api<{ assignments?: Array<{ id: string }> }>("/student/assignments", {}, session.accessToken)
      .then((data) => {
        setAssignmentId(data.assignments?.[0]?.id ?? null);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [router]);

  if (!ready) return null;
  if (assignmentId) return <StudentAssignmentDetailView assignmentId={assignmentId} />;
  return <StudentAssignmentsView />;
}
