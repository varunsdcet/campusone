import { redirect } from "next/navigation";

/** Employer UX lives on /employer — not inside admin. */
export default function Page() {
  redirect("/employer");
}
