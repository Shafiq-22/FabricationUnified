import { redirect } from "next/navigation";

// Clients became the Point of Contact registry.
export default function ClientsRedirect() {
  redirect("/contacts");
}
