import { redirect } from "next/navigation";

/** Alias → live create-user flow (admin provisioning step 1). */
export default function Page() {
  redirect("/admin/users/create");
}
