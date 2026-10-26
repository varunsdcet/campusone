import { redirect } from "next/navigation";

export default async function Page({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const { user } = await searchParams;
  redirect(`/admin/faculty-profile/biography${user ? `?user=${encodeURIComponent(user)}` : ""}`);
}
