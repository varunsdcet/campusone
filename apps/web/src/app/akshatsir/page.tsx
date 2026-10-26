import type { Metadata } from "next";
import { MonicaLecture, type LectureTeacher } from "@/components/monica/MonicaLecture";

export const metadata: Metadata = {
  title: "Akshat Sir · Lecture reader",
};

const AKSHAT_SIR: LectureTeacher = {
  name: "Akshat Sir",
  slug: "akshatsir",
  narrateUrl: "/api/akshatsir/narrate",
  gender: "female",
  voiceLabel: "the Monica voice",
  prepareAll: 2,
  continuous: true,
};

export default function AkshatSirPage() {
  return <MonicaLecture teacher={AKSHAT_SIR} />;
}
