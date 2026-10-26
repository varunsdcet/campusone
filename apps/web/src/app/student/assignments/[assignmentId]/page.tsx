"use client";

import { useParams } from "next/navigation";
import { StudentAssignmentDetailView } from "@/components/StudentFunctionalViews";

export default function Page() {
  const params = useParams<{ assignmentId: string }>();
  return <StudentAssignmentDetailView assignmentId={params.assignmentId} />;
}
