import { notFound } from "next/navigation";
import { LiveScreen } from "@/components/LiveScreen";
import { getTeacherScreen } from "@/lib/teacherCatalog";

/** Fallback so instructor SIS screens are reachable even if a dedicated folder is missing. */
export default async function InstructorFigmaSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const path = `/instructor/f/${decodeURIComponent(String(slug ?? "")).trim()}`;
  if (!getTeacherScreen(path)) notFound();
  return <LiveScreen path={path} />;
}
