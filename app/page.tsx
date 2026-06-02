import { redirect } from "next/navigation";

// The app has no public landing page; route straight to the dashboard.
// Middleware bounces unauthenticated users to /login.
export default function RootPage() {
  redirect("/dashboard");
}
