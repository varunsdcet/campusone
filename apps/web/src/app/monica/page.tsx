import type { Metadata } from "next";
import { MonicaLecture } from "@/components/monica/MonicaLecture";

export const metadata: Metadata = {
  title: "Monica · Lecture reader",
};

export default function MonicaPage() {
  return <MonicaLecture />;
}
