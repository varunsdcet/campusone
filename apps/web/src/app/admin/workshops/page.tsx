import { redirect } from "next/navigation";

export default function Page() {
  redirect("/admin/workshops/enrolments?f.status=Pending");
}
