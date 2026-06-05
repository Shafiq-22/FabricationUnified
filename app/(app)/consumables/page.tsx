import { redirect } from "next/navigation";

// Consumables now lives under Procurement as a sub-tab.
export default function ConsumablesRedirect() {
  redirect("/procurement?tab=consumables");
}
