import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface AppConfig {
  companyName: string;
  departmentName: string;
}

export const getAppConfig = cache(async (): Promise<AppConfig> => {
  const supabase = createClient();
  const { data } = await supabase.from("app_config").select("key, value");
  const map: Record<string, string> = {};
  (data ?? []).forEach((r) => {
    if (r.value != null) map[r.key] = r.value;
  });
  return {
    companyName: map.company_name ?? "SIXCO",
    departmentName: map.department_name ?? "BAF — Workshop Steel Fabrication",
  };
});
