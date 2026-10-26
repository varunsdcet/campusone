import { redirect } from "next/navigation";

/** Real auth is /login — not a mock screen inside the admin shell. */
export default function Page() {
  redirect("/login");
}
