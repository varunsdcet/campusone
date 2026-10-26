"use client";

import { useEffect, type ComponentType } from "react";
import { useParams, useRouter } from "next/navigation";
import { BASE } from "./kit";
import { AdvancedSearch, StudentDirectory } from "./Directory";
import { CreateStudent } from "./CreateStudent";
import { StudentProfile } from "./Profile";
import { AcademicAlerts, BadgesQueue, BulkActions, DocumentsExports, EntryMarks, GradeReview, GradeSubmissions, LeaveQueue, StudentAssessmentsQueue, StudentFlagsQueue, StudentRequirementsQueue, TranscriptChanges, WithdrawQueue } from "./Queues";

const SCREENS: Record<string, ComponentType> = {
  browse: StudentDirectory,
  search: AdvancedSearch,
  create: CreateStudent,
  student: StudentProfile,
  alerts: AcademicAlerts,
  flags: StudentFlagsQueue,
  assessments: StudentAssessmentsQueue,
  requirements: StudentRequirementsQueue,
  leave: LeaveQueue,
  withdraw: WithdrawQueue,
  grades: GradeSubmissions,
  "transcript-changes": TranscriptChanges,
  "entry-marks": EntryMarks,
  badges: BadgesQueue,
  exports: DocumentsExports,
  bulk: BulkActions,
};

export function StudentManagement() {
  const params = useParams<{ slug?: string[] }>();
  const router = useRouter();
  const [key = "", sub = ""] = params?.slug ?? [];
  const Screen = key === "grades" && sub === "review" ? GradeReview : SCREENS[key];
  useEffect(() => {
    if (!Screen) router.replace(`${BASE}/browse`);
  }, [Screen, router]);
  return Screen ? <Screen /> : null;
}
