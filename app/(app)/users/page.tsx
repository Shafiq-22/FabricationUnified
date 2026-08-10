import { redirect } from "next/navigation";

// User management now lives inside Settings as a sub-tab.
export default function UsersRedirect() {
  redirect("/settings?tab=users");
}
