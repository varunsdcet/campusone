"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { FacultiesDirectory, FacultyForm, ProgramPage, ProgramTypeForm, ProgramTypes } from "./Faculties";
import { CalendarForm, CalendarsList, TermForm, TermReview, TermsList } from "./Terms";
import { ManageSchedule, MasterStep1, ScheduleDirectory, SessionPage, TermStep1, TermStep2, TermStep3 } from "./Scheduling";
import { BASE } from "./kit";

const SCREENS: Record<string, () => React.ReactElement> = {
  faculties: () => <FacultiesDirectory />,
  "faculties/faculty-new": () => <FacultyForm mode="create" />,
  "faculties/faculty-edit": () => <FacultyForm mode="edit" />,
  "faculties/program-new": () => <ProgramPage mode="create" />,
  "faculties/program": () => <ProgramPage mode="edit" />,
  "program-types": () => <ProgramTypes />,
  "program-types/new": () => <ProgramTypeForm mode="create" />,
  "program-types/edit": () => <ProgramTypeForm mode="edit" />,
  terms: () => <TermsList />,
  "terms/new": () => <TermForm mode="create" />,
  "terms/edit": () => <TermForm mode="edit" />,
  "terms/review": () => <TermReview />,
  calendars: () => <CalendarsList />,
  "calendars/new": () => <CalendarForm mode="create" />,
  "calendars/edit": () => <CalendarForm mode="edit" />,
  scheduling: () => <ScheduleDirectory />,
  "scheduling/master-new": () => <MasterStep1 />,
  "scheduling/term-new": () => <TermStep1 />,
  "scheduling/review": () => <TermStep2 />,
  "scheduling/confirm": () => <TermStep3 />,
  "scheduling/manage": () => <ManageSchedule />,
  "scheduling/session": () => <SessionPage />,
};

export function ProgramManagement() {
  const params = useParams<{ slug?: string[] }>();
  const router = useRouter();
  const key = (params?.slug ?? []).join("/");
  const Screen = SCREENS[key];
  useEffect(() => {
    if (!Screen) router.replace(`${BASE}/faculties`);
  }, [Screen, router]);
  return Screen ? <Screen key={key} /> : null;
}
